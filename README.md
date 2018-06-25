# Disintegrate
A small JS library to break DOM elements into animated Canvas particles.

## Installation

You can either include [html2canvas.js](https://github.com/niklasvh/html2canvas/releases) and Disintegrate.js directly into your project before using it or use `npm install disintegrate`. Make sure to call `disintegrate.init()` after Disintegrate (and html2canvas) is loaded for it to start applying its effects. 

### Demos

- Contained demos
	- [Draggable demo](https://zachsaucier.github.io/Disintegrate/disintegrate-draggable.html)
	- [CSS animation demo](https://zachsaucier.github.io/Disintegrate/disintegrate-contain.html)

- Self-contained demos
	- [Click effect demos](https://zachsaucier.github.io/Disintegrate/disintegrate-self-contained.html)

- [Simultaneous demo](https://zachsaucier.github.io/Disintegrate/disintegrate-simultaneous.html)

- Other feature demos
	- [Trigger demo](https://zachsaucier.github.io/Disintegrate/disintegrate-trigger.html)
	- [Hover demo](https://zachsaucier.github.io/Disintegrate/disintegrate-hover.html)

### Creating custom effects

#### Adding a custom particle type

To add a custom particle type, simply create your particle to match the following format. For examples of custom particle creation, see [the self-contained demo source](https://github.com/ZachSaucier/Disintegrate/blob/gh-pages/disintegrate-self-contained.html). 

```
/* These are the attributes that Disintegrate will update or call in a Particle */
var ExampleParticle = function() {
  // Used to calculate the total percent finished of the animation
  // It should the equal to the longest time you want a particle to animate for
  this.animationDuration = <int>;

  // Updated only once when created
  this.startX = <int>;
  this.startY = <int>;
  this.rgbArray = [r, g, b, <a>];
  
  // Called until percent is greater than 1 (100%)
  this.draw = function(ctx, percent) { };
}
```

Then call `disAddParticleType("ExampleParticle");` where `ExampleParticle` matches the name of your custom particle.

#### Creating custom animations

In addition to the examples shown in the demos, you can use any CSS or JavaScript animations on the Disintegrate element and optionally container element. Animations have no effect on simultaneous Disintegrate elements.  

### Disintegrate HTML attributes

Applied on the Disintegrate element itself:

- `data-dis-type=<"contained" || "self-contained" || "simultaneous">` - Contained elements use an existing parent element as its Disintegrate container. Self-contained elements create a new div parent to be used as the Disintegrate container. Simultaneous elements don't make use of a container at all, but rather give the Particle full access to all of the element's color data at once to be processed as desired. 
- (optional) `data-dis-particle-type="ExampleParticle"` - This tells Disintegrate which particle type to use for a particular Disintegrate element. 
- (optional) `data-dis-reduction-factor="35"` - This reduces the number of particles created by the factor specified. The default is 35, which means only 1 of every 35th pixel in the element will be created. For large elements, this reduction factor should be higher for performance reasons. 
- (optional) `data-dis-color="[r, g, b]"` - This overrides Disintegrate's color detection on a per-pixel level and forces particles to be created solely with the color given in RGB format. 
- (optional) `data-dis-ignore-colors="[r, g, b] <, ...[r, g, b]>"` - This is a color or list of colors for Disintegrate to ignore, meaning that it won't create any particles with the given color. 
- (optional) `data-dis-id="myDisId"` - This specifies a Disintegrate ID for a particular element. It could be a Disintegrate element of a Disintegrate container's ID. 
- (optional) `data-dis-container-id="myContainerId"` - This is applicable on a Disintegrate element and specifies a Disintegrate container's ID to look for to be used as its container. It is for contained Disintegrate elements only. 

Applied on the desired container:

- (optional) `data-dis-container` - Specifies for this container to be used for any contained child Disintegrate elements unless a specific Disintegrate container is provided. 
- (optional) `data-dis-id="myDisId"` - This specifies a Disintegrate ID for a particular element. It could be a Disintegrate element of a Disintegrate container's ID. 

Used in the demos for continuity but has no direct connection to Disintegrate: 

- (informal) `data-dis-trigger-for="myDisId"` - Used in the trigger demo to specify which self-contained Disintegrate element should fire when this element is clicked. 

### Disintegrate JavaScript events

These events are fired on the `window`. 

- `disesLoaded` - Fires when Disintegrate is done processing all of the Disintegrate elements on the page. 
- `particlesReady` - Fires when all of the html2canvas canvases have been created. 

These events are fired on the Disintegrate element itself. 

- `disOutOfBounds` - Fires when a contained Disintegrate element goes completely outside of its container's bounds. 
- `disInBounds` - Fires when a contained Disintegrate element completely reenters its container's bounds after having gone out of its parent's bounds before. 
- `disComplete` - Fires when the animation duration for the Disintegrate element is complete (i.e. all particles are done animating). 

### Exposed API
After including disintegrate.js, the following are available to your code to use as needed:

- `disintegrate.init()` - Start Disintegrate (necessary for Disintegrate to be able to load in a Node file without error)
- `disintegrate.dises` - An array of all Disintegrate objects. 
- `disintegrate.createSimultaneousParticles(disObj)` - A function to intiate the simultaneous particle creation for the given Disintegrate object. 
- `disintegrate.getDisObj(element)` - A function to get the Disintegrate object for a given element.
- `disintegrate.addParticleType(Function)` - A function to add custom particle types that Disintegrate can recognize. It must at minimum meet Disintegrate's requirements for a particle. 

### Known limitations

Most limitations on this approach stem from the use of [html2canvas](http://html2canvas.hertzen.com/) to render the DOM element on a Canvas. This includes, but is not limited to, nested transforms within the Disintegrate element and the lack of clip path support. For a more full list of limitations caused by html2canvas, look at [its feature page](http://html2canvas.hertzen.com/features/)). 	

