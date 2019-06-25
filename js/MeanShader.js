THREE.MeanShader = {
    defines: {
      'NUMBER_TEXTURE': 0.0
    },

    uniforms: {
      // Texture from the previous shader
      "sampleLevel": {value: 0},
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
