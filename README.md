# 3dmediaexplorer
Backbone component that runs 3D scenes with hotspots. Using three.js as 3D engine.

## Purpose
I created this component to have the ability to load FBX 3D models and have hotspots assigned to them.

The hotspots would be created as Dummy objects in the 3D scene. So its up to the 3D designer to add the Dummy objects.

## Requirements
This component requires Backbone and the Adapt framework.  Please install Adapt and copy to the components folder.

* [Adapt](https://github.com/adaptlearning/adapt_framework)
* [ThreeJS](https://threejs.org/)

## Attributes

[**core model attributes**](https://github.com/adaptlearning/adapt_framework/wiki/Core-model-attributes): These are inherited by every Adapt component. [Read more](https://github.com/adaptlearning/adapt_framework/wiki/Core-model-attributes).

**_component** (string): This value must be: `narrative`.

**_classes** (string): CSS class name to be applied to **Narrative**’s containing div. The class must be predefined in one of the Less files. Separate multiple classes with a space.

**_layout** (string): This defines the horizontal position of the component in the block. Acceptable values are `full`, `left` or `right`; however, `full` is typically the only option used as `left` or `right` do not allow much room for the component to display.

**instruction** (string): This optional text appears above the component. It is frequently used to guide the learner’s interaction with the component.   

**mobileInstruction** (string): This is optional instruction text that will be shown when viewed on mobile. It may be used to guide the learner’s interaction with the component.   

**debug** (boolean): Enable debug mode, will show logging information and viewport stats.

**coverImage** (string): This is optional URL property to have the component load a splash screen at startup.

**texturePath** (string): This is a required URL property to set the path of the textures linked to the 3D scenes.  The component will then preload the textures.

**hotspotsTexture** (string): This is a required URL property to set the path of the hotspot texture. The component will then preload this texture.

**hotspotsSelectedTexture** (string): This is a required URL property to set the path of the hotspot texture. The component will then preload this texture.

**isNaviationLocked** (boolean): Determines if you want to lock progress to the next 3D scene.

**_items** (array): Multiple items may be created. Each item represents one slide and contains values for the 3D scene (**type**, **model**), the texture (**texture**), the background (**background3d**) and the hotspots (**_items**).

>**type** (string): This can be a hotspot scene or video.

>**model** (string): This is the main 3D scene filename, preferred to be of FBX format.

>**texture** (string): This is the main texture attached to the 3D scene. For performance reasons it is best to have the texture as Unwrapped. However, multiple images are supported.

>**background3d** (string): This is optional, the main background texture attached to the 3D scene.

>**_items** (array  ): Multiple hotspot items. Each item represents one 3D slide and contains values for the scene (**title**, **body**), and the image (**image**).

>>**title** (string): This value is the title for this element.

>>**body** (string): This is the main text for this element.

>>**image** (object): The image that appears in the popup. 

----------------------------
**Version number:**  4.0.0   <a href="https://community.adaptlearning.org/" target="_blank"><img src="https://github.com/adaptlearning/documentation/blob/master/04_wiki_assets/plug-ins/images/adapt-logo-mrgn-lft.jpg" alt="adapt learning logo" align="right"></a> 
**Framework versions:** 4+
**Author / maintainer:** Rafael Alvarado Emmanuelli    
**Accessibility support:** WAI AA   
**RTL support:** no  
**Cross-platform coverage:** Chrome, Chrome for Android, Firefox (ESR + latest version), Edge, IE11, IE Mobile 11, Safari 11+12 for macOS+iOS, Opera
