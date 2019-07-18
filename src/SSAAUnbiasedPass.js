
const THREE = require("three-full");

const UnbiasedShader = require("./SSAAUnbiasedShader");

/**
 * @author Manon Sutter / https://github.com/ManonSutter
 * @author Maxime Quiblier / https://github.com/maximeq
 * @author Dualbox / www.dualbox.com
 */
var SSAAUnbiasedPass = function ( scene, camera, sampleLevelMin, sampleLevelMax) {

    THREE.Pass.call( this );

    this.scene = scene;
    this.camera = camera;

    this.autoCheckChange = false;
        this.newBuffer = null;
        this.oldBuffer = null;

    this.changed = false;
    this.finalRenderDone = false;

    // Sample levels, specified as n, where the number of samples is 2^n, so sampleLevel = 4, is 2^4 samples, 16.
    // Sample level used on moving scene
    this.sampleLevelMin = sampleLevelMin !== undefined ? sampleLevelMin : 2;
    // Sample level used on motionless scene
    this.sampleLevelMax = sampleLevelMax !== undefined ? sampleLevelMax : 5;

    if ( UnbiasedShader === undefined ) console.error( "THREE.SSAAUnbiasedPass relies on UnbiasedShader" );

    var shader = UnbiasedShader;

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
        this.material
    );
    this.quad.frustumCulled = false; // Avoid getting clipped
    this.sceneQuad.add( this.quad );

    this.renderTarget = [];
    // Index of the last computed renderer on a motionless scene
    this.nextRenderIndex = 0;

    this.uniformsMean = THREE.UniformsUtils.clone( shader.uniforms );
    this.textureMean = [];
    this.materialMean = new THREE.ShaderMaterial( {
        uniforms: this.uniformsMean,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader

    } );
    this.materialMean.defines[ 'NUMBER_TEXTURE' ] = 8.0;

    if (THREE.REVISION !== "101"){
        console.error("In next versions of threejs line 67 to 73:\n this.quadMean = new THREE.Pass.FullScreenQuad( this.materialMean );");
    }

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

    this.materialCompare = new THREE.ShaderMaterial({
        uniforms: {
            oldRender: { value: null },
            newRender: { value: null }
        },
        vertexShader: [
            "varying vec2 vUv;",
            "void main() {",

            "   vUv = uv;",
            "   gl_Position = vec4( position, 1.0 );",

            "}"
        ].join("\n"),
        fragmentShader: [
            "uniform sampler2D oldRender;",
            "uniform sampler2D newRender;",
            "varying vec2 vUv;",

            "void main() {",

            "	vec4 oldRender = texture2D( oldRender, vUv );",
            "	vec4 newRender = texture2D( newRender, vUv );",
            "   float diff = clamp(abs(oldRender[0]-newRender[0]) + abs(oldRender[1]-newRender[1]) + abs(oldRender[2]-newRender[2]) + abs(oldRender[3]-newRender[3]),0.0,1.0);",
            "   gl_FragColor = vec4(diff,0.0,0.0,0.0);",

            "}"
        ].join("\n"),
    });
    this.quadCompare = new THREE.Mesh(
        new THREE.PlaneBufferGeometry( 2, 2 ),
        this.materialCompare
    );
    this.quadCompare.frustumCulled = false;
    this.sceneQuadCompare = new THREE.Scene();
    this.sceneQuadCompare.add( this.quadCompare );

    this.materialSubdivide = new THREE.ShaderMaterial({
        uniforms: {
            render: { value: null },
        },
        vertexShader: [
            "varying vec2 vUv;",
            "void main() {",

            "   vUv = uv;",
            "   gl_Position = vec4( position, 1.0 );",

            "}"
        ].join("\n"),
        fragmentShader: [
            "uniform sampler2D render;",
            "varying vec2 vUv;",

            "void main() {",

            "	vec4 lowerLeft = texture2D( render, vUv );",
            "	vec4 upperLeft = texture2D( render, vec2(vUv[0],vUv[1]+0.5) );",
            "	vec4 lowerRight = texture2D( render, vec2(vUv[0]+0.5,vUv[1]) );",
            "	vec4 upperRight = texture2D( render, vec2(vUv[0]+0.5,vUv[1]+0.5) );",
            "   float diff = lowerLeft[0]  + upperLeft[0] + lowerRight[0] + upperRight[0];",
            "   gl_FragColor = vec4(diff,0.,0.,0.);",

            "}"
        ].join("\n"),
    });

    this.quadSubdivide = new THREE.Mesh(
        new THREE.PlaneBufferGeometry( 2, 2 ),
        this.materialSubdivide
    );
    this.quadSubdivide.frustumCulled = false;
    this.quadSubdivide.geometry.attributes.uv.array[1] /= 2;
    this.quadSubdivide.geometry.attributes.uv.array[2] /= 2;
    this.quadSubdivide.geometry.attributes.uv.array[3] /= 2;
    this.quadSubdivide.geometry.attributes.uv.array[6] /= 2;
    this.sceneQuadSubdivide = new THREE.Scene();
    this.sceneQuadSubdivide.add( this.quadSubdivide );

};

SSAAUnbiasedPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

    constructor: SSAAUnbiasedPass,

    dispose: function () {

        for (var i = 0 ; i < 4 ; i++){
            this.material[i].dispose();
        }

        for (var i = 0; i < this.renderTarget.length; i++){
            if ( this.renderTarget[i] ) this.renderTarget[i].dispose();
        }

        for (var i = 0; i < this.renderTargetMean.length; i++){
            if ( this.renderTargetMean[i] ) this.renderTargetMean[i].dispose();
        }

        this.sceneQuad.dispose();

        for (var i = 0 ; i < 4 ; i++){
            this.sceneQuadMean[i].dispose();
        }

        this.materialMean.dispose();
        this.materialCompare.dispose();
        if (this.newRender){
            this.newRender.dispose();
            if (this.oldRender) this.oldRender.dispose();
            if (this.renderTargetCompare) this.renderTargetCompare.dispose();
            if (this.sceneQuadCompare) this.sceneQuadCompare.dispose();
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
        if ( this.sampleLevelMax < this.sampleLevelMin ) console.error( "SampleLevelMax must be higher than sampleLevelMin" );
    },

    setSampleLevelMin: function (levelMin){
        this.sampleLevelMin = levelMin;
        if ( this.sampleLevelMax < this.sampleLevelMin ) console.error( "SampleLevelMax must be higher than sampleLevelMin" );
    },

    /**
     *  To be called when the scene has changed to ensure progressive anti-aliasing computation
     *  will restart from the beginning.
     *  If autoCheckChange is set to true, setting this flag is not necessary as a complete test
     *  will be automatically made. However, manually setting this flag will skip the automatic test,
     *  saving some performances.
     *
     */
    hasChanged: function (){
        if (!this.changed){
            this.changed = true;
            this.finalRenderDone = false;
            // If the scene moves before the end of the max computation
            this.nextRenderIndex = 0;
            this.nextRenderMeanIndex = 0;
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

            if ( this.renderTargetMean[i] ){
                this.renderTargetMean[i].setSize( width, height );
            }
        }

        if (this.newRender){
            var newWidth = Math.pow(2,Math.ceil(Math.log2(width)));
            var newHeight = Math.pow(2,Math.ceil(Math.log2(height)));
            if (this.newRender.width !== newWidth || this.newRender.height !== newHeight){
                this.newRender.setSize( newWidth, newHeight );
                if (this.renderTargetCompare) this.renderTargetCompare.setSize( newWidth, newHeight );
                if (this.renderTargetSubdivide) this.renderTargetSubdivide.setSize( newWidth/2, newHeight/2);
                if (this.oldRender) this.oldRender.setSize( newWidth, newHeight );
                if (this.buffer) this.buffer = new Uint8Array( newWidth * newHeight );
            }
        }
        this.hasChanged();
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
                            format: THREE.RGBAFormat
                        }
                    );
            }
            var offset = !this.changed ? this.nextRenderIndex : this.nextRenderMeanIndex*8;

            var jitterOffset = this.jitterOffsets[ offset + i ]; // this.nextRenderIndex = beginning = 0 for levels < 4
            if ( this.camera.setViewOffset ) {
                this.camera.setViewOffset(
                    width, height,
                    jitterOffset[ 0 ] * 0.0625, jitterOffset[ 1 ] * 0.0625,   // 0.0625 = 1 / 16
                    width, height
                );
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

    meanCalculation: function (renderer, writeBuffer, readBuffer, sampleLevel){

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

                    if (!this.renderTargetMean[this.nextRenderMeanIndex]) {
                        this.renderTargetMean[this.nextRenderMeanIndex] = new THREE.WebGLRenderTarget(
                            readBuffer.width,
                            readBuffer.height,
                            {
                                minFilter: THREE.LinearFilter,
                                magFilter: THREE.NearestFilter,
                                format: THREE.RGBAFormat,
                                depthBuffer: false,
                                stencilBuffer: false
                            }
                        );
                    }

                    // We use 8 renderTargets per shader to do the average
                    for (var i = 0; i < 8 ; i++){
                        this.textureMean[i] = this.renderTarget[i].texture;
                    }
                    this.uniformsMean[ "texture" ].value = this.textureMean;

                    if (THREE.REVISION !== "101"){
                        console.error("In next versions of threejs :\n render.setRenderTarget( [this.nextRenderMeanIndex] ); \n this.quadMean( renderer );");
                    }

                    renderer.render(
                        this.sceneQuadMean,
                        this.cameraQuad,
                        this.renderTargetMean[this.nextRenderMeanIndex]
                    );

                    this.texture[this.nextRenderMeanIndex] = this.renderTargetMean[this.nextRenderMeanIndex].texture;
                    this.uniforms["texture"].value = this.texture;

                    this.nextRenderMeanIndex ++;

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

        // Only check if changed has not been set to true
        if (!this.changed && this.autoCheckChange){
            // Check if the scene has changed (array comparison)

            var width = Math.pow(2,Math.ceil(Math.log2(readBuffer.width)));
            var height = Math.pow(2,Math.ceil(Math.log2(readBuffer.height)));

            this.newRender = this.newRender ||
                            new THREE.WebGLRenderTarget(
                                width,
                                height,
                                {
                                    minFilter: THREE.LinearFilter,
                                    magFilter: THREE.NearestFilter,
                                    format: THREE.RGBAFormat
                                }
            );
            renderer.render(this.scene, this.camera, this.newRender);
            if (!this.oldRender){

                this.renderTargetCompare = new THREE.WebGLRenderTarget(
                    width,
                    height,
                    {
                        minFilter: THREE.LinearFilter,
                        magFilter: THREE.NearestFilter,
                        format: THREE.RGBFormat,
                        depthBuffer: false,
                        stencilBuffer: false
                    }
                );

                this.renderTargetSubdivide = new THREE.WebGLRenderTarget(
                    width/2,
                    height/2,
                    {
                        minFilter: THREE.LinearFilter,
                        magFilter: THREE.NearestFilter,
                        format: THREE.RGBAFormat,
                        depthBuffer: false,
                        stencilBuffer: false
                    }
                );

                this.hasChanged();
                this.oldRender = this.newRender;
                this.newRender = null;
            } else {

                this.materialCompare.uniforms["newRender"].value = this.newRender.texture;
                this.materialCompare.uniforms["oldRender"].value = this.oldRender.texture;

                renderer.render(this.sceneQuadCompare, this.camera, this.renderTargetCompare);

                this.materialSubdivide.uniforms["render"].value = this.renderTargetCompare.texture;

                renderer.render(this.sceneQuadSubdivide, this.camera, this.renderTargetSubdivide);
                this.buffer = this.buffer || new Uint8Array( width * height ); // width/2 * height/2 *4

                renderer.readRenderTargetPixels( this.renderTargetSubdivide, 0, 0, width/2, height/2, this.buffer);
                console.log(this.buffer.length);
                for (var i = 0; i < this.buffer.length; i+=4){
                    if (this.buffer[i] !== 0){
                        this.hasChanged();
                        break;
                    }
                }
                var swap = this.oldRender;
                this.oldRender = this.newRender;
                this.newRender = swap;
            }
        }

        if (this.changed){

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

        this.changed = false;
    }

} );

// These jitter vectors are specified in integers because it is easier.
// I am assuming a [-8,8] integer grid, but it needs to be mapped onto [-0.5,0.5)
// before being used, thus these integers need to be scaled by 1/16.
//
// Sample patterns reference: https://msdn.microsoft.com/en-us/library/windows/desktop/ff476218%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
SSAAUnbiasedPass.JitterVectors = [
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

module.exports = SSAAUnbiasedPass;
