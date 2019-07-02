SSAA pass which fixes the texture problem of the THREE.JS' one.
This development was sponsored by Dualbox (<https://www.dualbox.com/>)

#### THREE.JS Version 101 ####

## Concept ##

The algorithm is based on the algorithm of THREE.SSAARenderPass. The difference between the two algorithms is how the average calculus is done.
It also provides the possibility to adapt the level of render according to the motion of the scene, as the THREE.TAARenderPass does. The attribute `changed` allows to control it manually, while the pass can automatically detect the movement of the scene when the attribute `autoCheckChange` is set to true.

## Authors

* **Manon Sutter** - *Engineering and implementation* - [ManonSutter](https://github.com/ManonSutter)
* **Maxime Quiblier** - *Idea, Architecture and API* - [maximeq](https://github.com/maximeq)
* **Dualbox** - *Sponsoring* - [maximeq](https://www.dualbox.com)