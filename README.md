SSAA pass which fixes the texture problem of the THREE.JS' one.
The idea comes from the company Dioxygen (<https://www.dualbox.com/>)

# THREE.JS Version 101 #

## Concept ##

The algorithm is based on the algorithm of THREE.SSAARenderPass, only the way to do the average changes.
It also provides the possibility to adapt the level of render according to the motion of the scene, as the THREE.TAARenderPass does. The attribute `changed` allows to control it manually, while the pass can automatically detect the movement of the scene when the attribute `autoCheckChange` is to true.
