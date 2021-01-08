
const THREE = require("three");

require('./CheckTHREE')

const SSAAUnbiased = {
    SSAAUnbiasedPass: require("./SSAAUnbiasedShader"),
    SSAAUnbiasedShader: require("./SSAAUnbiasedPass")
};


THREE.SSAAUnbiasedPass = SSAAUnbiased.SSAAUnbiasedPass;
THREE.SSAAUnbiasedShader = SSAAUnbiased.SSAAUnbiasedShader;

module.exports = SSAAUnbiased;
