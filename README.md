# Three.js Unbiased SSAA

Simple SSAA pass for three js which fixes the bias issue found in THREE revision 101 and before.

This development was sponsored by Dualbox (<https://www.dualbox.com/>).

## The issue

Here is a shadow texture processed on the left by this unbiased ssaa, and on the right by the SSAA pass in THREE.JS examples before revision 101.

![unbiasedShadow](https://user-images.githubusercontent.com/51316383/60586238-f5baf580-9d91-11e9-901c-514d4cc2af7a.png)
![biasedShadow](https://user-images.githubusercontent.com/51316383/60586247-f8b5e600-9d91-11e9-8a57-be92694c6e52.png)


## THREE.JS Version
The version used to implement this module is the THREE revision 101. Most of the lines to modify for a more recent version are specified by a console error in the concerned file. It has not yet been done since at the time this readme is written the three-full last revision has an unacceptable bug which prevent us from using the last THREE.JS version.

## Concept

The algorithm is based on the algorithm of THREE.SSAARenderPass. The difference between the two algorithms is how the averaging computation is made: while the THREE.SSAARenderPass does the average of two rendereds at a time, number of samples times, the THREE.SSAAUnbiasedPass does the average of the number of samples in one time, if it is lower or equal to 8, in two times if it is not.

It also provides the possibility to adapt the level of render according to the motion of the scene, as the THREE.TAARenderPass does.
The attribute `changed` allows to control it manually, while the pass can automatically detect the movement of the scene when the attribute `autoCheckChange` is set to true.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Authors

* **Manon Sutter** - *Engineering and implementation* - [ManonSutter](https://github.com/ManonSutter)
* **Maxime Quiblier** - *Idea, Architecture and API* - [maximeq](https://github.com/maximeq)
* **Dualbox** - *Sponsoring* - [www.dualbox.com](https://www.dualbox.com)
