
THREE.SSAAMeanPass = function ( scene, camera, sampleLevelMin, sampleLevelMax) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.autoCheckChange = false;


  this.changed = false;
	this.finalRenderDone = false;

  // Sample levels, specified as n, where the number of samples is 2^n, so sampleLevel = 4, is 2^4 samples, 16.
	// Sample level used on moving scene
  this.sampleLevelMin = sampleLevelMin !== undefined ? sampleLevelMin : 2;
	// Sample level used on motionless scene
  this.sampleLevelMax = sampleLevelMax !== undefined ? sampleLevelMax : 5;

  if ( THREE.MeanShader === undefined ) console.error( "THREE.SSAAMeanPass relies on THREE.MeanShader" );

	var shader = THREE.MeanShader;

	this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

  this.material = new THREE.ShaderMaterial( {

    uniforms: this.uniforms,
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,

  } );

	// Final Scene
	this.cameraQuad = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.sceneQuad = new THREE.Scene();

	this.quad = new THREE.Mesh(
		new THREE.PlaneBufferGeometry( 2, 2 ),
		this.material );
	this.quad.frustumCulled = false; // Avoid getting clipped
	this.sceneQuad.add( this.quad );

	this.renderTarget = [];
	// Index of the last computed renderer on a motionless scene
	this.nextRenderIndex = 0;

	this.uniformsMean = THREE.UniformsUtils.clone( shader.uniforms );
	this.uniformsMean["sampleLevel"].value = 3;
	this.materialMean = new THREE.ShaderMaterial( {
		uniforms: this.uniformsMean,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader

	} );

	this.sceneQuadMean = new THREE.Scene();

	this.quadMean = new THREE.Mesh(
		new THREE.PlaneBufferGeometry( 2, 2 ),
		this.materialMean
	);
	this.quadMean.frustumCulled = false; // Avoid getting clipped
	this.sceneQuadMean.add( this.quadMean );

	// RenderTargets 1 and 2 for the cases with sample > 3
	// RenderTargets 1 to 4 for the cases with sample > 4
	this.renderTargetMean = [];
	this.nextRenderMeanIndex = 0;

};

THREE.SSAAMeanPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.SSAAMeanPass,

	dispose: function () {

    this.material.dispose();

    for (var i = 0; i < this.renderTarget.length; i++){
  		if ( this.renderTarget[i] ) {

  			this.renderTarget[i].dispose();
  			this.renderTarget[i] = null;

		  }
    }

		for (var i = 0; i < this.renderTargetMean.length; i++){

			if ( this.renderTargetMean[i] ){

				this.renderTargetMean[i].dispose();
				this.renderTargetMean[i] = null;

			}

		}

		this.sceneQuad.dispose();

		for (var i = 0 ; i < 4 ; i++){
			this.sceneQuadMean[i].dispose();
		}

		for (var i = 0 ; i < 4 ; i++){
			this.materialMean[i].dispose();
		}

	},

	setCamera: function (camera){
		if (this.camera != camera){
			this.camera = camera;
			this.finalRenderDone = false;
			this.nextRenderIndex = 0;
			this.nextRenderMeanIndex = 0;
		}
	},

	setScene: function (scene){
		if (this.scene != scene){
			this.scene = scene;
			this.finalRenderDone = false;
			this.nextRenderIndex = 0;
			this.nextRenderMeanIndex = 0;
		}
	},

	setSampleLevelMax: function (sampleLevelMax){
		if (this.sampleLevelMax != sampleLevelMax){
			this.sampleLevelMax = sampleLevelMax;
			this.finalRenderDone = false;
			this.nextRenderIndex = 0;
			this.nextRenderMeanIndex = 0;
		}
	},

	setSampleLevelMin: function (levelMin){
		this.sampleLevelMin = levelMin;
	},

	setChanged: function (changed){
		if (this.changed != changed){
			this.changed = changed;
			this.finalRenderDone = false;
			// If the scene moves before the end of the max computation
			this.nextRenderIndex = 0;
			this.nextRenderMeanIndex = 0;
		}
	},

	setSize: function ( width, height ) {
		for (var i = 0; i < this.renderTarget.length; i++){

			if ( this.renderTarget[i] ) {
				this.renderTarget[i].setSize( width, height );
			}

			if ( this.renderTargetMean[i] ){
				this.renderTargetMean[i].setSize( width, height );
			}
		}
	},

  createRenderTarget: function ( renderer , writeBuffer , readBuffer , nbrRenderToDo){

		var nbrRender = Math.min(nbrRenderToDo,8);
		var beginning = this.nextRenderIndex % 8; // If !this.changed --> = 0

		for ( var i = 0; i < Math.min(
			nbrRender,
			Math.pow(2, this.sampleLevelMax) - this.nextRenderIndex) ; i ++ ) {

      var width = readBuffer.width;
      var height = readBuffer.height;

      if ( ! this.renderTarget[i + beginning] ) {
        this.renderTarget.push(
					new THREE.WebGLRenderTarget(
						width,
						height,
						{
							minFilter: THREE.LinearFilter,
							magFilter: THREE.NearestFilter,
							format: THREE.RGBFormat
						}
					)
				);
      }

      var jitterOffset = this.jitterOffsets[ this.nextRenderIndex + i ]; // this.nextRenderIndex = beginning = 0 for levels < 4
      if ( this.camera.setViewOffset ) {
        this.camera.setViewOffset( width, height,
          jitterOffset[ 0 ] * 0.0625, jitterOffset[ 1 ] * 0.0625,   // 0.0625 = 1 / 16
          width, height );
      }

      renderer.render( this.scene, this.camera , this.renderTarget[ i + beginning ]);
    }

		if (!this.changed){
			this.nextRenderIndex = Math.min(
				this.nextRenderIndex + nbrRender,
				Math.pow(2, this.sampleLevelMax)
			);
		}

		return nbrRenderToDo -= nbrRender;

  },

	meanCalculation: function (renderer, writeBuffer, readBuffer, sampleLevel){

		// Retrieve the matrix of the coordinates of the corresponding sampleLevel
		this.jitterOffsets = THREE.SSAAMeanPass.JitterVectors[ Math.max( 0, Math.min( sampleLevel, 5 ) ) ];

		var nbrRenderToDo = this.changed ? this.jitterOffsets.length : Math.pow( 2, this.sampleLevelMin );

		while (nbrRenderToDo != 0){

			// we create the renderTargets, the scene each slightly jitter offset
			nbrRenderToDo = this.createRenderTarget(
				renderer, writeBuffer, readBuffer, nbrRenderToDo
			);

			var size = this.changed ? this.jitterOffsets.length : this.nextRenderIndex;

			if (size >= 8 && this.jitterOffsets.length > 8){

				if (size%8 === 0){

					if (!this.renderTargetMean[this.nextRenderMeanIndex]) {
						this.renderTargetMean.push(
							new THREE.WebGLRenderTarget(
								readBuffer.width,
								readBuffer.height,
								{
									minFilter: THREE.LinearFilter,
									magFilter: THREE.NearestFilter,
									format: THREE.RGBFormat
								}
							)
						);

					}

					// We use 8 renderTargets per shader to do the average
					for (var i = 0; i < 8 ; i++){
						this.uniformsMean[ "texture" + i ].value =
						this.renderTarget[i].texture;
					}

					renderer.render(
						this.sceneQuadMean,
						this.cameraQuad,
						this.renderTargetMean[this.nextRenderMeanIndex]
					);

					this.uniforms["texture" + this.nextRenderMeanIndex].value =
					this.renderTargetMean[this.nextRenderMeanIndex].texture;

					this.nextRenderMeanIndex ++;

				}
				// Case of sampleLevel = 4 (16 samples) we do the average of 2 averages of 8
				// Case of sampleLevel = 5 (32 samples) we do the average of 4 averages of 8
				this.uniforms["sampleLevel"].value = Math.trunc(size/16);

			} else {
				this.uniforms[ "sampleLevel" ].value = this.changed ? sampleLevel : Math.trunc(Math.log2(size));

				// We do 1 average of 1, 2, 4 or 8 textures
				for (var i = 0; i < Math.min(size,8) ; i++){
					this.uniforms[ "texture"+ i ].value = this.renderTarget[i].texture;
				}
			}

		}

	},

	render: function ( renderer , writeBuffer, readBuffer ) {

		if ( this.sampleLevelMax < this.sampleLevelMin ) console.error( "SampleLevelMax must be higher than sampleLevelMin" );

		var sampleLevel = -1;

		var autochanged = false;
		// Check if the scene has changed (array comparison)
		// TODO : check computing time readPixels + comparison


		if (this.changed || autochanged){

			// We render with a low sampleLevel
		  sampleLevel = this.sampleLevelMin;
			this.finalRenderDone = false;
			this.nextRenderMeanIndex = 0;

		} else {

			// We render with a hight sampleLevel
			sampleLevel = this.sampleLevelMax;

		}

		// Case of the scene moving and the first motionless renderers
		if (!this.finalRenderDone){

			this.meanCalculation( renderer, writeBuffer, readBuffer, sampleLevel);
			if (this.nextRenderIndex === Math.pow(2, this.sampleLevelMax)){
				this.finalRenderDone = true;
			}

		}
		// Else we keep the old renderer

		if ( this.renderToScreen ) {

			renderer.render( this.sceneQuad, this.cameraQuad );

		} else {

			if ( this.clear ) renderer.clear();
			renderer.render( this.sceneQuad, this.cameraQuad , writeBuffer);

		}

		if ( this.camera.clearViewOffset ) this.camera.clearViewOffset();

	}

} );

// These jitter vectors are specified in integers because it is easier.
// I am assuming a [-8,8] integer grid, but it needs to be mapped onto [-0.5,0.5)
// before being used, thus these integers need to be scaled by 1/16.
//
// Sample patterns reference: https://msdn.microsoft.com/en-us/library/windows/desktop/ff476218%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
THREE.SSAAMeanPass.JitterVectors = [
	[
		[ 0, 0 ]
	],
	[
		[ 4, 4 ], [ - 4, - 4 ]
	],
	[
		[ - 2, - 6 ], [ 6, - 2 ], [ - 6, 2 ], [ 2, 6 ]
	],
	[
		[ 1, - 3 ], [ - 1, 3 ], [ 5, 1 ], [ - 3, - 5 ],
		[ - 5, 5 ], [ - 7, - 1 ], [ 3, 7 ], [ 7, - 7 ]
	],
	[
		[ 1, 1 ], [ - 1, - 3 ], [ - 3, 2 ], [ 4, - 1 ],
		[ - 5, - 2 ], [ 2, 5 ], [ 5, 3 ], [ 3, - 5 ],
		[ - 2, 6 ], [ 0, - 7 ], [ - 4, - 6 ], [ - 6, 4 ],
		[ - 8, 0 ], [ 7, - 4 ], [ 6, 7 ], [ - 7, - 8 ]
	],
	[
		[ - 4, - 7 ], [ - 7, - 5 ], [ - 3, - 5 ], [ - 5, - 4 ],
		[ - 1, - 4 ], [ - 2, - 2 ], [ - 6, - 1 ], [ - 4, 0 ],
		[ - 7, 1 ], [ - 1, 2 ], [ - 6, 3 ], [ - 3, 3 ],
		[ - 7, 6 ], [ - 3, 6 ], [ - 5, 7 ], [ - 1, 7 ],
		[ 5, - 7 ], [ 1, - 6 ], [ 6, - 5 ], [ 4, - 4 ],
		[ 2, - 3 ], [ 7, - 2 ], [ 1, - 1 ], [ 4, - 1 ],
		[ 2, 1 ], [ 6, 2 ], [ 0, 4 ], [ 4, 4 ],
		[ 2, 5 ], [ 7, 5 ], [ 5, 6 ], [ 3, 7 ]
	]
];
