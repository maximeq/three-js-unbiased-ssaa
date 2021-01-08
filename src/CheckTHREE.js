const THREE = require('three');

function checkExample( example, subdirectory, trueName ) {

    if ( THREE[example] === undefined )
        throw `THREE is missing example '${example}' and, as such, three-js-unbiased-ssaa can't work properly. You can find it` +
        ` in '@dualbox/three/examples/js/${subdirectory !== undefined ? subdirectory + '/' : ''}${trueName || example}.js'`

}

checkExample('Pass', 'postprocessing', 'EffectComposer')
