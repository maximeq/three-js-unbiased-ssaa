
const THREE = require("three-full");

var THREESSAAUnbiasedPass = require("./SSAAUnbiasedPass");
var THREESSAAUnbiasedShader = require("./SSAAUnbiasedShader");

THREE.SSAAUnbiasedPass = THREESSAAUnbiasedPass;
THREE.SSAAUnbiasedShader = THREESSAAUnbiasedShader;

var SSAAUnbiased = {
    SSAAUnbiasedPass:THREESSAAUnbiasedPass,
    SSAAUnbiasedShader:THREESSAAUnbiasedShader
};

module.exports = SSAAUnbiased;
