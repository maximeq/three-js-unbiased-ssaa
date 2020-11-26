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
        "inputTextures": {value: null}
    },

    vertexShader: [
        "varying vec2 vUv;",

        "void main() {",
            "vUv = uv;",
            "gl_Position = vec4( position, 1.0 );",
        "}"
    ].join("\n"),
    fragmentShader: [
        "uniform sampler2D inputTextures[ NUMBER_TEXTURE ];",
        "varying vec2 vUv;",

        "void main() {",

        "   vec4 color = vec4(0,0,0,0);",
        "   ",
        "   #pragma unroll_loop_start",
        "   for (int i = 0; i < NUMBER_TEXTURE; i++)",
        "   {",
        "       color += texture2D( inputTextures[i], vUv);",
        "   }",
        "   #pragma unroll_loop_end",
        "   ",
        "   float nbrTex = float(NUMBER_TEXTURE);",
        "   gl_FragColor = color/nbrTex;",

        "}"
    ].join("\n")
};

module.exports = UnbiasedShader;
