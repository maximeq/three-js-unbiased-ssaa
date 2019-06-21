

THREE.MeanShader = {
    uniforms: {
      // Texture from the previous shader
      "sampleLevel": {value: 0},
      "texture0": {value: null},
      "texture1": {value: null},
      "texture2": {value: null},
      "texture3": {value: null},
      "texture4": {value: null},
      "texture5": {value: null},
      "texture6": {value: null},
      "texture7": {value: null}
    },

    vertexShader: [
      "varying vec2 vUv;",

      "void main() {",
        "vUv = uv;",
        "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform int sampleLevel;",
      "uniform sampler2D texture0;",
      "uniform sampler2D texture1;",
      "uniform sampler2D texture2;",
      "uniform sampler2D texture3;",
      "uniform sampler2D texture4;",
      "uniform sampler2D texture5;",
      "uniform sampler2D texture6;",
      "uniform sampler2D texture7;",
      "varying vec2 vUv;",

      "void main() {",
          "vec4 color;",
          "vec4 color0 = texture2D( texture0, vUv);",
          "vec4 color1 = texture2D( texture1, vUv);",
          "vec4 color2 = texture2D( texture2, vUv);",
          "vec4 color3 = texture2D( texture3, vUv);",
          "vec4 color4 = texture2D( texture4, vUv);",
          "vec4 color5 = texture2D( texture5, vUv);",
          "vec4 color6 = texture2D( texture6, vUv);",
          "vec4 color7 = texture2D( texture7, vUv);",
          "if (sampleLevel == 0){",
            "color.rgb = color0.rgb;",
            // "color.rgb = vec3(1,0,0);",
          "}",
          "if (sampleLevel == 1){",
            "color.rgb = (color0.rgb + color1.rgb)/2.0;",
            // "color.rgb = vec3(0,1,0);",
          "}",
          "if (sampleLevel == 2){",
            "color.rgb = (color0.rgb + color1.rgb + color2.rgb + color3.rgb)/4.0;",
            // "color.rgb = vec3(0,0,1);",
          "}",
          "if (sampleLevel == 3){",
            "color.rgb = (color0.rgb + color1.rgb + color2.rgb + color3.rgb + color4.rgb + color5.rgb + color6.rgb + color7.rgb)/8.0;",
            // "color.rgb = vec3(1,1,0);",
          "}",
          "gl_FragColor = vec4(color.rgb,1.0);",
      "}"
    ].join("\n")
  };
