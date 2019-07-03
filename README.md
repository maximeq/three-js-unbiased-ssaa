# three.js-ssaa

Simple SSAA pass fr three js which fixes the bias issue found in THREE revision 101 and before.

This development was sponsored by Dualbox (<https://www.dualbox.com/>)

#### THREE.JS Version 101 ####

## Concept

The algorithm is based on the algorithm of THREE.SSAARenderPass. The difference between the two algorithms is how the averaging computation is made.

It also provides the possibility to adapt the level of render according to the motion of the scene, as the THREE.TAARenderPass does.
The attribute `changed` allows to control it manually, while the pass can automatically detect the movement of the scene when the attribute `autoCheckChange` is set to true.

## Authors

* **Manon Sutter** - *Engineering and implementation* - [ManonSutter](https://github.com/ManonSutter)
* **Maxime Quiblier** - *Idea, Architecture and API* - [maximeq](https://github.com/maximeq)
* **Dualbox** - *Sponsoring* - [www.dualbox.com](https://www.dualbox.com)
