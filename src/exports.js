
const THREE = require("three");

require('./CheckTHREE')

const SSAAUnbiased = {
    SSAAUnbiasedPass: require("./SSAAUnbiasedPass"),
    SSAAUnbiasedShader: require("./SSAAUnbiasedShader")
};


THREE.SSAAUnbiasedPass = SSAAUnbiased.SSAAUnbiasedPass;
THREE.SSAAUnbiasedShader = SSAAUnbiased.SSAAUnbiasedShader;

module.exports = SSAAUnbiased;
