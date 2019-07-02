
THREE.SSAAUnbiasedPass = function ( scene, camera, sampleLevelMin, sampleLevelMax) {

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

  if ( THREE.UnbiasedShader === undefined ) console.error( "THREE.SSAAUnbiasedPass relies on THREE.UnbiasedShader" );

    var shader = THREE.UnbiasedShader;

    this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
    this.texture = [];

  this.material = [];
    for (var i = 0; i<4; i++){
        this.material[i] = new THREE.ShaderMaterial( {
            uniforms: this.uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
        } );
        this.material[i].defines[ 'NUMBER_TEXTURE' ] = Math.pow(2,i);
    }

    // Final Scene

    if (THREE.REVISION !== "101"){
        console.error("In next versions of threejs line 41 to 47:\n this.quad = new THREE.Pass.FullScreenQuad( this.material );");
    }

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

    this.uniformsUnbiased = THREE.UniformsUtils.clone( shader.uniforms );
    this.textureUnbiased = [];
    this.materialUnbiased = new THREE.ShaderMaterial( {
        uniforms: this.uniformsUnbiased,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader

    } );
    this.materialUnbiased.defines[ 'NUMBER_TEXTURE' ] = 8.0;

    if (THREE.REVISION !== "101"){
        console.error("In next versions of threejs line 67 to 73:\n this.quadUnbiased = new THREE.Pass.FullScreenQuad( this.materialUnbiased );");
    }

    this.sceneQuadUnbiased = new THREE.Scene();

    this.quadUnbiased = new THREE.Mesh(
        new THREE.PlaneBufferGeometry( 2, 2 ),
        this.materialUnbiased
    );
    this.quadUnbiased.frustumCulled = false; // Avoid getting clipped
    this.sceneQuadUnbiased.add( this.quadUnbiased );

    // RenderTargets 1 and 2 for the cases with sample > 3
    // RenderTargets 1 to 4 for the cases with sample > 4
    this.renderTargetUnbiased = [];
    this.nextRenderUnbiasedIndex = 0;

};

THREE.SSAAUnbiasedPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

    constructor: THREE.SSAAUnbiasedPass,

    dispose: function () {

        for (var i = 0 ; i < 4 ; i++){
            this.material[i].dispose();
        }

    for (var i = 0; i < this.renderTarget.length; i++){
          if ( this.renderTarget[i] ) {

              this.renderTarget[i].dispose();
              this.renderTarget[i] = null;

          }
    }

        for (var i = 0; i < this.renderTargetUnbiased.length; i++){

            if ( this.renderTargetUnbiased[i] ){

                this.renderTargetUnbiased[i].dispose();
                this.renderTargetUnbiased[i] = null;

            }

        }

        this.sceneQuad.dispose();

        for (var i = 0 ; i < 4 ; i++){
            this.sceneQuadUnbiased[i].dispose();
        }

        this.materialUnbiased.dispose();

    },

    setCamera: function (camera){
        if (this.camera != camera){
            this.camera = camera;
            this.finalRenderDone = false;
            this.nextRenderIndex = 0;
            this.nextRenderUnbiasedIndex = 0;
        }
    },

    setScene: function (scene){
        if (this.scene != scene){
            this.scene = scene;
            this.finalRenderDone = false;
            this.nextRenderIndex = 0;
            this.nextRenderUnbiasedIndex = 0;
        }
    },

    setSampleLevelMax: function (sampleLevelMax){
        if (this.sampleLevelMax != sampleLevelMax){
            this.sampleLevelMax = sampleLevelMax;
            this.finalRenderDone = false;
            this.nextRenderIndex = 0;
            this.nextRenderUnbiasedIndex = 0;
        }
        if ( this.sampleLevelMax < this.sampleLevelMin ) console.error( "SampleLevelMax must be higher than sampleLevelMin" );
    },

    setSampleLevelMin: function (levelMin){
        this.sampleLevelMin = levelMin;
        if ( this.sampleLevelMax < this.sampleLevelMin ) console.error( "SampleLevelMax must be higher than sampleLevelMin" );
    },

    setChanged: function (changed){
        if (this.changed != changed){
            this.changed = changed;
            this.finalRenderDone = false;
            // If the scene moves before the end of the max computation
            this.nextRenderIndex = 0;
            this.nextRenderUnbiasedIndex = 0;
        }
    },

    setAutoCheckChange: function (autoCheckChange){
        this.autoCheckChange = autoCheckChange;
    },

    setSize: function ( width, height ) {
        for (var i = 0; i < this.renderTarget.length; i++){

            if ( this.renderTarget[i] ) {
                this.renderTarget[i].setSize( width, height );
            }

            if ( this.renderTargetUnbiased[i] ){
                this.renderTargetUnbiased[i].setSize( width, height );
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

      if ( ! this.renderTarget[ i + beginning ] ) {
        this.renderTarget[ i + beginning ] =
                new THREE.WebGLRenderTarget(
                        width,
                        height,
                        {
                            minFilter: THREE.LinearFilter,
                            magFilter: THREE.NearestFilter,
                            format: THREE.RGBFormat
                        }
                    );
      }
            var offset = !this.changed ? this.nextRenderIndex : this.nextRenderUnbiasedIndex*8;

      var jitterOffset = this.jitterOffsets[ offset + i ]; // this.nextRenderIndex = beginning = 0 for levels < 4
      if ( this.camera.setViewOffset ) {
        this.camera.setViewOffset( width, height,
          jitterOffset[ 0 ] * 0.0625, jitterOffset[ 1 ] * 0.0625,   // 0.0625 = 1 / 16
          width, height );
      }

            if (THREE.REVISION !== "101"){
                console.error("In next versions of threejs :\n render.setRenderTarget(this.renderTarget[ i + beginning ]); \n renderer.clear(); \n this.renderer( this.scene, this.camera);");
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

    UnbiasedCalculation: function (renderer, writeBuffer, readBuffer, sampleLevel){

        // Retrieve the matrix of the coordinates of the corresponding sampleLevel
        this.jitterOffsets = THREE.SSAAUnbiasedPass.JitterVectors[ Math.max( 0, Math.min( sampleLevel, 5 ) ) ];

        var nbrRenderToDo = this.changed ? this.jitterOffsets.length : Math.pow( 2, this.sampleLevelMin );

        while (nbrRenderToDo != 0){

            // we create the renderTargets, the scene each slightly jitter offset
            nbrRenderToDo = this.createRenderTarget(
                renderer, writeBuffer, readBuffer, nbrRenderToDo
            );

            var size = this.changed ? this.jitterOffsets.length : this.nextRenderIndex;

            if (size >= 8 && this.jitterOffsets.length > 8){

                if (size%8 === 0){

                    if (!this.renderTargetUnbiased[this.nextRenderUnbiasedIndex]) {
                        this.renderTargetUnbiased[this.nextRenderUnbiasedIndex] = new THREE.WebGLRenderTarget(
                            readBuffer.width,
                            readBuffer.height,
                            {
                                minFilter: THREE.LinearFilter,
                                magFilter: THREE.NearestFilter,
                                format: THREE.RGBFormat
                            }
                        );
                    }

                    // We use 8 renderTargets per shader to do the average
                    for (var i = 0; i < 8 ; i++){
                        this.textureUnbiased[i] = this.renderTarget[i].texture;
                    }
                    this.uniformsUnbiased[ "texture" ].value = this.textureUnbiased;

                    if (THREE.REVISION !== "101"){
                        console.error("In next versions of threejs :\n render.setRenderTarget( [this.nextRenderUnbiasedIndex] ); \n this.quadUnbiased( renderer );");
                    }

                    renderer.render(
                        this.sceneQuadUnbiased,
                        this.cameraQuad,
                        this.renderTargetUnbiased[this.nextRenderUnbiasedIndex]
                    );

                    this.texture[this.nextRenderUnbiasedIndex] = this.renderTargetUnbiased[this.nextRenderUnbiasedIndex].texture;
                    this.uniforms["texture"].value = this.texture;


                    this.nextRenderUnbiasedIndex ++;

                }
                // Case of sampleLevel = 4 (16 samples) we do the average of 2 averages of 8
                // Case of sampleLevel = 5 (32 samples) we do the average of 4 averages of 8
                this.quad.material = this.material[Math.trunc(size/16)];

            } else {

                this.quad.material = this.material[this.changed ? sampleLevel : Math.trunc(Math.log2(size))]
                // We do 1 average of 1, 2, 4 or 8 textures
                for (var i = 0; i < Math.min(size,8) ; i++){
                    this.texture[i] = this.renderTarget[i].texture;
                }
                this.uniforms[ "texture" ].value = this.texture;
            }

        }

    },

    render: function ( renderer , writeBuffer, readBuffer ) {

        var sampleLevel = -1;

        var autoClear = renderer.autoClear;
        renderer.autoClear = true;

        var oldClearColor = renderer.getClearColor().getHex();
        var oldClearAlpha = renderer.getClearAlpha();

        if (this.autoCheckChange){
            var autoChanged = false;
            // Check if the scene has changed (array comparison)
            newBuffer = new Uint8Array( readBuffer.width * readBuffer.height * 4);
            renderer.readRenderTargetPixels( readBuffer, 0, 0, readBuffer.width, readBuffer.height, newBuffer);
            if (!this.oldBuffer){
                autoChanged = true;
            } else {

                for (var i = 0; i < newBuffer.length; i++){

                    if (newBuffer[i] !== this.oldBuffer[i]){
                        autoChanged = true;
                        break;
                    }
                }

            }

            this.oldBuffer = newBuffer;
            this.setChanged(autoChanged);
        }

        if (this.changed){

            // We render with a low sampleLevel
          sampleLevel = this.sampleLevelMin;
            this.finalRenderDone = false;
            this.nextRenderUnbiasedIndex = 0;

        } else {

            // We render with a hight sampleLevel
            sampleLevel = this.sampleLevelMax;

        }

        // Case of the scene moving and the first motionless renderers
        if (!this.finalRenderDone){

            this.UnbiasedCalculation( renderer, writeBuffer, readBuffer, sampleLevel);
            if (this.nextRenderIndex === Math.pow(2, this.sampleLevelMax)){
                this.finalRenderDone = true;
            }

        }
        // Else we keep the old renderer

        if ( this.renderToScreen ) {

            if (THREE.REVISION !== "101"){
                console.error("In next versions of threejs :\n renderer.setRenderTarget( null ); \n this.quad.render( renderer );");
            }

            renderer.render( this.sceneQuad, this.cameraQuad );

        } else {

            if (THREE.REVISION !== "101"){
                console.error("In next versions of threejs :\n renderer.setRenderTarget( writeBuffer ); \n if ( this.clear ) renderer.clear();\n this.quad.render( renderer );");
            }

            renderer.render( this.sceneQuad, this.cameraQuad , writeBuffer);

        }

        if ( this.camera.clearViewOffset ) this.camera.clearViewOffset();

        renderer.autoClear = autoClear;
        renderer.setClearColor( oldClearColor, oldClearAlpha );
    }

} );

// These jitter vectors are specified in integers because it is easier.
// I am assuming a [-8,8] integer grid, but it needs to be mapped onto [-0.5,0.5)
// before being used, thus these integers need to be scaled by 1/16.
//
// Sample patterns reference: https://msdn.microsoft.com/en-us/library/windows/desktop/ff476218%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
THREE.SSAAUnbiasedPass.JitterVectors = [
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
