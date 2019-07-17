(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three-full')) :
    typeof define === 'function' && define.amd ? define(['three-full'], factory) :
    (global.THREESSAAUnbiasedPass = factory(global.THREE));
}(this, (function (threeFull) { 'use strict';

    threeFull = threeFull && threeFull.hasOwnProperty('default') ? threeFull['default'] : threeFull;

    /**
     * @author Manon Sutter / https://github.com/ManonSutter
     * @author Maxime Quiblier / https://github.com/maximeq
     * @author Dualbox / www.dualbox.com
     */

    var UnbiasedShader = {
        defines: {
            'NUMBER_TEXTURE': 0.0
        },

        uniforms: {
            "texture": {value: null}
        },

        vertexShader: [
            "varying vec2 vUv;",

            "void main() {",
                "vUv = uv;",
                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
            "}"
        ].join("\n"),
        fragmentShader: [
            "uniform sampler2D texture[ NUMBER_TEXTURE ];",
            "varying vec2 vUv;",

            "void main() {",

                "vec4 color = vec4(0,0,0,0);",
                "for (int i = 0; i < NUMBER_TEXTURE; i++)",
                "{",
                    "color += texture2D( texture[i], vUv);",
                "}",
                "float nbrTex = float(NUMBER_TEXTURE);",
                "gl_FragColor = color/nbrTex;",

            "}"
        ].join("\n")
    };

    var SSAAUnbiasedShader = UnbiasedShader;

    /**
     * @author Manon Sutter / https://github.com/ManonSutter
     * @author Maxime Quiblier / https://github.com/maximeq
     * @author Dualbox / www.dualbox.com
     */
    var SSAAUnbiasedPass = function ( scene, camera, sampleLevelMin, sampleLevelMax) {

        threeFull.Pass.call( this );

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

        if ( SSAAUnbiasedShader === undefined ) console.error( "THREE.SSAAUnbiasedPass relies on UnbiasedShader" );

        var shader = SSAAUnbiasedShader;

        this.uniforms = threeFull.UniformsUtils.clone( shader.uniforms );
        this.texture = [];

        this.material = [];
        for (var i = 0; i<4; i++){
            this.material[i] = new threeFull.ShaderMaterial( {
                uniforms: this.uniforms,
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader,
            } );
            this.material[i].defines[ 'NUMBER_TEXTURE' ] = Math.pow(2,i);
        }

        // Final Scene

        if (threeFull.REVISION !== "101"){
            console.error("In next versions of threejs line 41 to 47:\n this.quad = new THREE.Pass.FullScreenQuad( this.material );");
        }

        this.cameraQuad = new threeFull.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
        this.sceneQuad = new threeFull.Scene();

        this.quad = new threeFull.Mesh(
            new threeFull.PlaneBufferGeometry( 2, 2 ),
            this.material
        );
        this.quad.frustumCulled = false; // Avoid getting clipped
        this.sceneQuad.add( this.quad );

        this.renderTarget = [];
        // Index of the last computed renderer on a motionless scene
        this.nextRenderIndex = 0;

        this.uniformsMean = threeFull.UniformsUtils.clone( shader.uniforms );
        this.textureMean = [];
        this.materialMean = new threeFull.ShaderMaterial( {
            uniforms: this.uniformsMean,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader

        } );
        this.materialMean.defines[ 'NUMBER_TEXTURE' ] = 8.0;

        if (threeFull.REVISION !== "101"){
            console.error("In next versions of threejs line 67 to 73:\n this.quadMean = new THREE.Pass.FullScreenQuad( this.materialMean );");
        }

        this.sceneQuadMean = new threeFull.Scene();

        this.quadMean = new threeFull.Mesh(
            new threeFull.PlaneBufferGeometry( 2, 2 ),
            this.materialMean
        );
        this.quadMean.frustumCulled = false; // Avoid getting clipped
        this.sceneQuadMean.add( this.quadMean );

        // RenderTargets 1 and 2 for the cases with sample > 3
        // RenderTargets 1 to 4 for the cases with sample > 4
        this.renderTargetMean = [];
        this.nextRenderMeanIndex = 0;

        this.materialCompare = new threeFull.ShaderMaterial({
            uniforms: {
                oldRender: { value: null },
                newRender: { value: null }
            },
            vertexShader: [
                "varying vec2 vUv;",
                "void main() {",

                "   vUv = uv;",
                "   gl_Position = vec4(position,1);",

                "}"
            ].join("\n"),
            fragmentShader: [
                "uniform sampler2D oldRender;",
                "uniform sampler2D newRender;",
                "varying vec2 vUv;",

                "void main() {",

                "	vec4 oldRender = texture2D( oldRender, vUv );",
                "	vec4 newRender = texture2D( newRender, vUv );",
                "   gl_FragColor = vec4(abs(oldRender[0]-newRender[0]) + abs(oldRender[1]-newRender[1]) + abs(oldRender[2]-newRender[2]) + abs(oldRender[3]-newRender[3]),0,0,0);",

                "}"
            ].join("\n"),
        });

    };

    SSAAUnbiasedPass.prototype = Object.assign( Object.create( threeFull.Pass.prototype ), {

        constructor: SSAAUnbiasedPass,

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

            this.materialMean.dispose();
            this.materialCompare.dispose();
            if (this.newRender){
                this.newRender.dispose();
            }
            if (this.oldRender){
                this.oldRender.dispose();
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
                    if (this.renderTargetCompare){
                        this.renderTargetCompare.setSize( newWidth, newHeight );
                    }
                    if (this.oldRender){
                        this.oldRender.setSize( newWidth, newHeight );
                    }
                    if (this.buffer){
                        this.buffer = new Uint8Array( newWidth * newHeight * 4 );
                    }
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
                        new threeFull.WebGLRenderTarget(
                            width,
                            height,
                            {
                                minFilter: threeFull.LinearFilter,
                                magFilter: threeFull.NearestFilter,
                                format: threeFull.RGBAFormat
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

                if (threeFull.REVISION !== "101"){
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
            this.jitterOffsets = threeFull.SSAAUnbiasedPass.JitterVectors[ Math.max( 0, Math.min( sampleLevel, 5 ) ) ];

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
                            this.renderTargetMean[this.nextRenderMeanIndex] = new threeFull.WebGLRenderTarget(
                                readBuffer.width,
                                readBuffer.height,
                                {
                                    minFilter: threeFull.LinearFilter,
                                    magFilter: threeFull.NearestFilter,
                                    format: threeFull.RGBAFormat
                                }
                            );
                        }

                        // We use 8 renderTargets per shader to do the average
                        for (var i = 0; i < 8 ; i++){
                            this.textureMean[i] = this.renderTarget[i].texture;
                        }
                        this.uniformsMean[ "texture" ].value = this.textureMean;

                        if (threeFull.REVISION !== "101"){
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

                    this.quad.material = this.material[this.changed ? sampleLevel : Math.trunc(Math.log2(size))];
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
                                new threeFull.WebGLRenderTarget(
                                    width,
                                    height,
                                    {
                                        minFilter: threeFull.LinearFilter,
                                        magFilter: threeFull.NearestFilter,
                                        format: threeFull.RGBAFormat
                                    }
                );
                renderer.render(this.scene, this.camera, this.newRender);
                if (!this.oldRender){

                    this.quadCompare = new threeFull.Mesh(
                        new threeFull.PlaneBufferGeometry( 2, 2 ),
                        this.materialCompare
                    );
                    this.quadCompare.frustumCulled = false; // Avoid getting clipped
                    this.sceneQuadCompare = new threeFull.Scene();
                    this.sceneQuadCompare.add( this.quadCompare );
                    this.renderTargetCompare = new threeFull.WebGLRenderTarget(
                        width,
                        height,
                        {
                            minFilter: threeFull.LinearFilter,
                            magFilter: threeFull.NearestFilter,
                            format: threeFull.RGBAFormat
                        }
                    );

                    this.hasChanged();
                    this.oldRender = this.newRender;
                    this.newRender = null;
                } else {
                    this.materialCompare.uniforms["newRender"].value = this.newRender.texture;
                    this.materialCompare.uniforms["oldRender"].value = this.oldRender.texture;

                    renderer.render(this.sceneQuadCompare, this.camera, this.renderTargetCompare);

                    this.buffer = this.buffer || new Uint8Array( width * height * 4 );
                    renderer.readRenderTargetPixels( this.renderTargetCompare, 0, 0, width, height, this.buffer);
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

                if (threeFull.REVISION !== "101"){
                    console.error("In next versions of threejs :\n renderer.setRenderTarget( null ); \n this.quad.render( renderer );");
                }

                renderer.render( this.sceneQuad, this.cameraQuad );

            } else {

                if (threeFull.REVISION !== "101"){
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

    var SSAAUnbiasedPass_1 = SSAAUnbiasedPass;

    threeFull.SSAAUnbiasedPass = SSAAUnbiasedPass_1;
    threeFull.SSAAUnbiasedShader = SSAAUnbiasedShader;

    var SSAAUnbiased = {
        SSAAUnbiasedPass:SSAAUnbiasedPass_1,
        SSAAUnbiasedShader:SSAAUnbiasedShader
    };

    var exports$1 = SSAAUnbiased;

    return exports$1;

})));
