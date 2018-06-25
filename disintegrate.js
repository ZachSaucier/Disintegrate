// UMD format: https://github.com/umdjs/umd/blob/master/templates/returnExports.js#L17
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module
    define(['html2canvas'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require('html2canvas'));
  } else {
    // Browser globals
    root.disintegrate = factory(root.html2canvas);
  }
}(typeof self !== 'undefined' ? self : this, function (html2canvas) {

"use strict"

/********************/
/* Helper functions */
/********************/

// Looks for any ancestor with a data attribute of the one given
// If none is found with the given attribute, the parentNode is used
function findParentWithAttr(el, attr) {
  let original = el;
  while ((el = el.parentElement) && !el.hasAttribute(attr));
  if(original === el) el = el.parentNode;
  return el;
} 

// From http://javascript.info/coordinates
function getCoords(elem) {
  let box = elem.getBoundingClientRect();

  return {
    top: box.top + pageYOffset,
    left: box.left + pageXOffset
  };
}

// Returns a JS array of arrays of numbers from a string
// Example input:   "[255, 255, 255], [35, 35, 35]"
// Example output:  [[255, 255, 255], [35, 35, 35]]
function getNumberArraysFromString(string) {
  let array = [];
  let re = /\[(.*?)(?=\])/g;
  let matches;
  do {
    matches = re.exec(string);
    if(matches)
      array.push(matches[1].split(',').map(Number));
  } while (matches);

  return array;
}

/**************************/
/* Disintegrate functions */
/**************************/

var disElems,
    dises = [],
    disParticleTypes = [];

// Create a disObj for each Disintegrate element detected
function processDisElement(el) {
  let ignoreColors = [];
  if(el.dataset.disIgnoreColors) {
    ignoreColors = getNumberArraysFromString(el.dataset.disIgnoreColors);
  }

  let particleType = "Particle";
  if(el.dataset.disParticleType) {
    particleType = el.dataset.disParticleType;
  }

  let particleColor = [];
  if(el.dataset.disColor) {
    particleColor = getNumberArraysFromString(el.dataset.disColor)[0];
  }

  let particleReductionFactor = 35;
  if(el.dataset.disReductionFactor) {
    particleReductionFactor = parseInt(el.dataset.disReductionFactor);
  }

  let disObj = {
    elem: el,
    type: el.dataset.disType,
    container: undefined,
    actualWidth: el.offsetWidth,
    actualHeight: el.offsetHeight,
    lastWidth: el.offsetWidth,
    lastHeight: el.offsetHeight,
    count: 0,
    particleArr: [],
    animationDuration: 100,  // in ms 
    canvas: undefined,
    ctx: undefined,
    scrnCanvas: undefined,
    scrnCtx: undefined,
    ignoreColors: ignoreColors,
    isOutOfBounds: false,
    isAnimating: false,
    particleReductionFactor: particleReductionFactor,
    particleType: particleType,
    particleColor: particleColor
  };

  let container;
  if(disObj.type === "self-contained") {
    let parent = el.parentNode;
    let wrapper = document.createElement('div');
    wrapper.dataset.disContainer = "";
    wrapper.style.width = disObj.lastWidth;
    wrapper.style.height = disObj.lastHeight;
    wrapper.style.overflow = "hidden";
    let elemStyles = window.getComputedStyle(el);
    wrapper.style.position = elemStyles.getPropertyValue("position");
    wrapper.style.margin = elemStyles.getPropertyValue("margin");
    wrapper.style.top = elemStyles.getPropertyValue("top");
    wrapper.style.left = elemStyles.getPropertyValue("left");
    wrapper.style.display = elemStyles.getPropertyValue("display");
    el.style.margin = 0;
    el.style.top = 0;
    el.style.left = 0;

    disObj.container = wrapper;

    parent.replaceChild(wrapper, el);
    wrapper.appendChild(el);

    disObj.container = wrapper;
  } else if(disObj.type === "contained") {
    // Try to use the given container if a container Id is provided
    if(el.dataset.disContainerId && document.querySelector("[data-dis-id = '" + el.dataset.disContainerId + "']")) {
      disObj.container = document.querySelector("data-dis-container-id = " + el.dataset.disContainerId);
    } else {
      // Default to using the nearest Disintegrate container or the parent node
      disObj.container = findParentWithAttr(el, "data-dis-container");
    }
  }
  
  // Add this Disintegrate element to our list
  dises.push(disObj);
  // Create the canvases for this Disintegrate element
  getScreenshot(disObj);
  // See if all Dises have been loaded
  checkAllLoaded();
}

function getVisibleDimensions(node, referenceNode) {
  referenceNode = referenceNode || node.parentNode;
  
  let pos = getCoords(node);
  let referencePos = getCoords(referenceNode);

  let overflowingTop = false,
      overflowingRight = false,
      overflowingBottom = false,
      overflowingLeft = false;

  let topCalc = node.offsetHeight - (referencePos.top - pos.top);
  if(topCalc < node.offsetHeight) {
    overflowingTop = true;
  }
  let rightCalc = referencePos.left + referenceNode.offsetWidth - pos.left;
  if(rightCalc < node.offsetWidth) {
    overflowingRight = true;
  }
  let bottomCalc = referencePos.top + referenceNode.offsetHeight - pos.top;
  if(bottomCalc < node.offsetHeight) {
    overflowingBottom = true;
  }
  let leftCalc = node.offsetWidth - (referencePos.left - pos.left);
  if(leftCalc < node.offsetWidth) {
    overflowingLeft = true;
  }
  
  return {
    "boundingRect": pos,
    "referenceBoundingRect": referencePos,
    "width": Math.min(
      node.offsetWidth,
      rightCalc, 
      leftCalc
    ),
    "height": Math.min(
      node.offsetHeight, 
      bottomCalc,
      topCalc
    ),
    "overflowingTop": overflowingTop,
    "overflowingRight": overflowingRight,
    "overflowingBottom": overflowingBottom,
    "overflowingLeft": overflowingLeft
  }
}

// See if the given Dis object is outside of its Dis container.
// If part of it is (compared to the last check), create particles at the
// newly overflowed location.
function checkOutOfBounds(disObj) {
  let dimensions = getVisibleDimensions(disObj.elem, disObj.container);
  
  let visibleWidth = dimensions.width;
  let visibleHeight = dimensions.height;
  let pos = dimensions.boundingRect;
  let referencePos = dimensions.referenceBoundingRect;

  if(!disObj.isOutOfBounds && (visibleWidth <= 0 || visibleHeight <= 0)) {
    disObj.isOutOfBounds = true;
    disObj.elem.dispatchEvent(new Event('disOutOfBounds'));
  } else if(disObj.isOutOfBounds && (visibleWidth > 0 && visibleHeight > 0)) {
    disObj.isOutOfBounds = false;
    disObj.elem.dispatchEvent(new Event('disInBounds'));
  }

  disObj.actualWidth = disObj.elem.offsetWidth;
  disObj.actualHeight = disObj.elem.offsetHeight;

  let lastWidth = disObj.lastWidth;
  let lastHeight = disObj.lastHeight;

  let widthDiff = lastWidth - visibleWidth;
  let heightDiff = lastHeight - visibleHeight;

  let choppedLeft = disObj.actualWidth - visibleWidth;
  let choppedTop = disObj.actualHeight - visibleHeight;

  let containerIndex;
  if(visibleWidth !== lastWidth 
  || visibleHeight !== lastHeight) {
    containerIndex = disObj.particleArr.length;
    disObj.particleArr.push({
      "startTime": Date.now(),
      "myParticles": []
    });
  }

  let screenshotData; // Uint8ClampedArray

  // Right and left sides
  if(visibleWidth !== lastWidth) {

    if(Math.floor(widthDiff) > 0
    && Math.floor(visibleWidth) > 0
    && Math.floor(visibleHeight) > 0) {
  
      let worldX;

      // Right side
      if(dimensions.overflowingRight) {
        worldX = pos.left + visibleWidth;
      }

      if(dimensions.overflowingTop
      && dimensions.overflowingRight) { // Top right
        screenshotData = disObj.scrnCtx.getImageData(visibleWidth, choppedTop, widthDiff, visibleHeight).data;
      } else if(dimensions.overflowingRight) { // Right and bottom right
        screenshotData = disObj.scrnCtx.getImageData(visibleWidth, 0, widthDiff, visibleHeight).data;
      }

      // Process the pixels overflowed
      if(screenshotData) {
        for(let i = 0; i < screenshotData.length; i += 4) {
          // Do it every once in a while
          if(disObj.count % disObj.particleReductionFactor === 0) {
            let worldY = pos.top + Math.floor((i / 4) / widthDiff);

            if(dimensions.overflowingTop) {
              worldY += choppedTop;
            }
            let colorData;
            if(disObj.particleColor.length > 0) {
              colorData = disObj.particleColor;
            } else {
              colorData = screenshotData.slice(i, i + 4);
            }

            // Create a particle of the given pixel color at the given location
            createParticle(disObj, worldX - pos.left, worldY - pos.top, worldX, worldY, colorData, containerIndex);
          }
          disObj.count++;
        }
      } 

      // Left side
      if(dimensions.overflowingLeft) {
        worldX = referencePos.left; // or pos.left + choppedLeft
      }

      if(dimensions.overflowingTop
      && dimensions.overflowingLeft) { // Top left
        screenshotData = disObj.scrnCtx.getImageData(disObj.actualWidth - lastWidth, choppedTop, widthDiff, visibleHeight).data;
      } else if(dimensions.overflowingLeft) { // Left and bottom left
        screenshotData = disObj.scrnCtx.getImageData(disObj.actualWidth - lastWidth, 0, widthDiff, visibleHeight).data;
      }

      // Process the pixels overflowed
      if(screenshotData) {
        for(let i = 0; i < screenshotData.length; i += 4) {
          // Do it every once in a while
          if(disObj.count % disObj.particleReductionFactor === 0) {
            let worldY = pos.top + Math.floor((i / 4) / widthDiff);

            if(dimensions.overflowingTop) {
              worldY += choppedTop;
            }
            let colorData;
            if(disObj.particleColor.length > 0) {
              colorData = disObj.particleColor;
            } else {
              colorData = screenshotData.slice(i, i + 4);
            }

            // Create a particle of the given pixel color at the given location
            createParticle(disObj, worldX - pos.left, worldY - pos.top, worldX, worldY, colorData, containerIndex);
          }
          disObj.count++;
        }
      } 

    }

    disObj.lastWidth = visibleWidth;
  }

  // Top and bottom sides
  if(visibleHeight !== lastHeight) {
    if(Math.floor(heightDiff) > 0
    && Math.floor(visibleWidth) > 0
    && Math.floor(visibleHeight) > 0) {
      
      let worldY;

      // Top side
      if(dimensions.overflowingTop) {
        worldY = referencePos.top; // or pos.top + choppedTop
      }

      if(dimensions.overflowingTop
      && dimensions.overflowingLeft) { // Top left
        screenshotData = disObj.scrnCtx.getImageData(choppedLeft, disObj.actualHeight - lastHeight, visibleWidth, heightDiff).data;
      } else if(dimensions.overflowingTop) { // Top and top right
        screenshotData = disObj.scrnCtx.getImageData(0, disObj.actualHeight - lastHeight, visibleWidth, heightDiff).data;
      }

      // Process the pixels overflowed
      if(screenshotData) {
        for(let i = 0; i < screenshotData.length; i += 4) {
          // Do it every once in a while
          if(disObj.count % disObj.particleReductionFactor === 0) {
            let worldX = pos.left + (i / 4) % visibleWidth;

            if(dimensions.overflowingLeft) {
              worldX += choppedLeft;
            }
            let colorData;
            if(disObj.particleColor.length > 0) {
              colorData = disObj.particleColor;
            } else {
              colorData = screenshotData.slice(i, i + 4);
            }

            // Create a particle of the given pixel color at the given location
            createParticle(disObj, worldX - pos.left, worldY - pos.top, worldX, worldY, colorData, containerIndex);
          }
          disObj.count++;
        }
      } 

      // Bottom side
      if(dimensions.overflowingBottom) {
        worldY = pos.top + visibleHeight;
      }

      if(dimensions.overflowingBottom
      && dimensions.overflowingLeft) { // Bottom left
        screenshotData = disObj.scrnCtx.getImageData(choppedLeft, visibleHeight, visibleWidth, heightDiff).data;
      } else if(dimensions.overflowingBottom) { // Bottom and bottom right
        screenshotData = disObj.scrnCtx.getImageData(0, visibleHeight, visibleWidth, heightDiff).data;
      }

      // Process the pixels overflowed
      if(screenshotData) {
        for(let i = 0; i < screenshotData.length; i += 4) {
          // Do it every once in a while
          if(disObj.count % disObj.particleReductionFactor === 0) {
            let worldX = pos.left + (i / 4) % visibleWidth;

            if(dimensions.overflowingLeft) {
              worldX += choppedLeft;
            }
            let colorData;
            if(disObj.particleColor.length > 0) {
              colorData = disObj.particleColor;
            } else {
              colorData = screenshotData.slice(i, i + 4);
            }

            // Create a particle of the given pixel color at the given location
            createParticle(disObj, worldX - pos.left, worldY - pos.top, worldX, worldY, colorData, containerIndex);
          }
          disObj.count++;
        }
      } 
    }

    disObj.lastHeight = visibleHeight;
  }

  if(screenshotData) {
    disObj.isAnimating = true;
  } 
}

// Creates particles for the entire given Disintegrate object at once, to be 
// customized by the particle type used
function createSimultaneousParticles(disObj) {
  let dimensions = getVisibleDimensions(disObj.elem, disObj.container);
  let pos = dimensions.boundingRect;

  let screenshotData = getAllImageData(disObj);

  disObj.particleArr[0] = {
    "startTime": Date.now(),
    "myParticles": []
  };

  // Process the pixels
  if(screenshotData) {
    for(let i = 0; i < screenshotData.length; i += 4) {
      // Do it every once in a while
      if(disObj.count % disObj.particleReductionFactor === 0) {
        let worldX = pos.left + (i / 4) % dimensions.width;
        let worldY = pos.top + Math.floor((i / 4) / dimensions.width);

        let colorData;
        if(disObj.particleColor.length > 0) {
          colorData = disObj.particleColor;
        } else {
          colorData = screenshotData.slice(i, i + 4);
        }

        // Create a particle of the given pixel color at the given location
        createParticle(disObj, worldX - pos.left, worldY - pos.top, worldX, worldY, colorData, 0);
      }
      disObj.count++;
    }
  } 
}

// Take a "screenshot" of the given Dis object's element using html2canvas
var numCanvasesLoaded = 0;
function getScreenshot(disObj) {
  html2canvas(disObj.elem, { scale: 1 }).then( canvas => {
    numCanvasesLoaded++;
    if(typeof disObj.scrnCanvas === "undefined") {
      disObj.scrnCanvas = canvas;
      disObj.scrnCtx = canvas.getContext('2d');
    }
      
    // Create a canvas to draw particles on the size of the
    // given container element
    if(typeof disObj.canvas === "undefined") {
      disObj.canvas = document.createElement("canvas");
      disObj.canvas.width = document.documentElement.scrollWidth; 
      disObj.canvas.height = document.documentElement.scrollHeight;
      disObj.canvas.style.position = "absolute"; 
      disObj.canvas.style.top = 0;
      disObj.canvas.style.left = 0;
      disObj.canvas.style.userSelect = "none";
      disObj.canvas.style.pointerEvents = "none";
      disObj.canvas.style.zIndex = "1001";
      disObj.canvas.class = "disParticleCanvas";
      disObj.ctx = disObj.canvas.getContext('2d');
      document.body.appendChild(disObj.canvas);
    }

    if(numCanvasesLoaded === dises.length) {
      window.dispatchEvent(new Event('particlesReady'));
    }
  });
}

// Create a particle of the declared type at the given position using the given color
function createParticle(disObj, localX, localY, worldX, worldY, rgbArr, arrayIndex) {
  let dontCreate = false;

  // Don't render the particle if the color is in the ignored list
  if(disObj.ignoreColors.length > 0) {
    disObj.ignoreColors.some( colorArr => {
      if(colorArr.join(',') === rgbArr.slice(0, 3).join(',')) {
        dontCreate = true;
        return;
      }
    });
  }

  // Don't create particles within area not shown due to border radius
  // Currently only supports `border-radius: npx;` format
  let borderRadius = Math.min(
                      parseInt(window.getComputedStyle(disObj.elem).borderRadius), 
                      disObj.actualWidth / 2, 
                      disObj.actualHeight / 2
                     );
  if(borderRadius > 0
  && ( (localX < borderRadius && localY < borderRadius && borderRadius < Math.sqrt(Math.pow(borderRadius - localX, 2) + Math.pow(borderRadius - localY, 2)) ) // Top left
    || (localX > disObj.actualWidth - borderRadius && localY < borderRadius && borderRadius < Math.sqrt(Math.pow(localX - (disObj.actualWidth - borderRadius), 2) + Math.pow(borderRadius - localY, 2)) ) // Top right
    || (localX > disObj.actualWidth - borderRadius && localY > disObj.actualHeight - borderRadius && borderRadius < Math.sqrt(Math.pow(localX - (disObj.actualWidth - borderRadius), 2) + Math.pow(localY - (disObj.actualHeight - borderRadius), 2)) ) // Bottom right
    || (localX < borderRadius && localY > disObj.actualHeight - borderRadius && borderRadius < Math.sqrt(Math.pow(borderRadius - localX, 2) + Math.pow(localY - (disObj.actualHeight - borderRadius), 2)) ) // Bottom left
  )) {
    dontCreate = true;
  }

  if(!dontCreate) {
    let myType = disParticleTypes[0];
    // Make sure the particle type is in Disintegrate's particle type list
    disParticleTypes.forEach( type => {
      if(type.name === disObj.particleType) {
        myType = type;
      }
    });

    // Actually create the particle
    let particle = new myType;
    particle.rgbArray = rgbArr;
    particle.startX = worldX;
    particle.startY = worldY;
    particle.arrayIndex = arrayIndex;
    particle.index = disObj.particleArr[arrayIndex].myParticles.length;

    disObj.animationDuration = particle.animationDuration;
    disObj.particleArr[arrayIndex].myParticles.push(particle);
  }
}

// Animate all existing particles of the given Disintegrate element
// using their built in draw function
function animateParticles(disObj) {
  if(typeof disObj.ctx !== "undefined") {
    disObj.ctx.clearRect(0, 0, document.documentElement.scrollWidth, document.documentElement.scrollHeight);
  }

  for(let i = 0; (disObj.particleArr.length > 0 && i < disObj.particleArr.length); i++) {
    let percent = (Date.now() - disObj.particleArr[i].startTime) / disObj.animationDuration;

    for(let j = 0; j < disObj.particleArr[i].myParticles.length; j++) {
      disObj.particleArr[i].myParticles[j].draw(disObj.ctx, percent);
    }

    if(i === disObj.particleArr.length - 1 && percent > 1) { 
      // Garbage collect
      disObj.particleArr = [];
      // Mark complete
      disObj.elem.dispatchEvent(new Event('disComplete'));
      disObj.isAnimating = false;
    }
  }
}

// Check to see if all the Disintegrate elements detected have been successfully loaded
function checkAllLoaded() {
  if(disElems.length === dises.length) {
    window.dispatchEvent(new Event('disesLoaded'));
    window.requestAnimationFrame(disUpdate);
  }
}

// Return the disObj of a given element if it has one
function getDisObj(el) {
  let matchedDisObj = undefined;
  dises.forEach( disObj => {
    if(disObj.elem === el) {
      matchedDisObj = disObj;
    }
  });
  return matchedDisObj;
}

// Add a particle type for Disintegrate to recognize and look for
function addParticleType(func) {
  disParticleTypes.push(func);
}

// Returns a Uint8ClampedArray of image color data in r, g, b, a format per pixel
// for the whole given Disintegrate object
function getAllImageData(disObj) {
  return disObj.scrnCtx.getImageData(0, 0, disObj.actualWidth, disObj.actualHeight).data; 
}

// What actually checks the bounds and animates the existing particles
function disUpdate() {
  dises.forEach( disObj => {
    if(disObj.type !== "simultaneous") {
      checkOutOfBounds(disObj);
    }

    animateParticles(disObj);
  });

  window.requestAnimationFrame(disUpdate);
}

/*********************/
/* Runtime processes */
/*********************/

// Assure the initial capture is done
function init() {
  disElems = document.querySelectorAll("[data-dis-type]");
  
  window.addEventListener("load", () => {
    // Setup
    disElems.forEach( el => {
      if(el.tagName !== "IMG" || el.complete) {
        processDisElement(el);
      } else {
        el.addEventListener("load", e => {
          processDisElement(el);
        });
      }
    });
  });

  // Update the screenshot and canvas sizes when the window changes size
  var resizeTimer;
  window.addEventListener("resize", e => {

    // Wait for resize to "finish"
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout( () => {

      dises.forEach( disObj => {
        getScreenshot(disObj);

        disObj.canvas.width = document.documentElement.scrollWidth; 
        disObj.canvas.height = document.documentElement.scrollHeight;
      });

    }, 250);
  });
}



/*****************************/
/* Specific particle effects */
/*****************************/

/* An example of how particles could be created */

// Returns a number between -1 and 1 in a normalized (Gaussian) way using the central limit theorum
function genNormalizedVal() {
  return ((Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random() - 3)) / 3;
}

const EaseIn    = power => t => Math.pow(t, power),
      EaseOut   = power => t => 1 - Math.abs(Math.pow(t-1, power)),
      EaseInOut = power => t => t<.5 ? EaseIn(power)(t*2)/2 : EaseOut(power)(t*2 - 1)/2+0.5;
var Particle = function() {
  this.name = "Particle";
  this.animationDuration = 1000; // in ms

  this.widthScaler = Math.round(50 * genNormalizedVal()); // Normalized val between -50 and 50
  this.numWaves = (genNormalizedVal() + 1 / 2) * 2 + 1;
  this.xPosFunc = t => { return Math.sin(this.numWaves * Math.PI * t); }; 

  this.heightScaler = Math.round(65 * (genNormalizedVal() + 1) / 2) + 10; // Normalized val between 10 and 75
  this.yPosFunc = t => { return t; }; 
  
  this.startSize = 10;
  this.sizeFunc = t => { return 1 - t; };

  this.opacityFactor = Math.round(((genNormalizedVal() + 1) / 2) * 3 + 1);
  this.opacityFunc = t => { return 1 - EaseInOut(this.opacityFactor)(t); };
  
  this.draw = (ctx, percent) => {
    percent = percent >= 1 ? 1 : percent;

    let currX = this.startX + this.xPosFunc(percent) * this.widthScaler;
    let currY = this.startY - this.yPosFunc(percent) * this.heightScaler;
    let currSize = this.startSize * this.sizeFunc(percent);
    let currOpacity = this.opacityFunc(percent);

    ctx.fillStyle = "rgba(" + this.rgbArray[0] + ',' + this.rgbArray[1] + ',' + this.rgbArray[2] + ',' + currOpacity + ")";
    ctx.fillRect(currX - currSize / 2, currY  - currSize / 2, currSize, currSize);
  };
};
addParticleType(Particle);


/* An "exploding" particle effect that uses circles */
var ExplodingParticle = function() {
  this.name = "ExplodingParticle";
  this.animationDuration = 1000; // in ms

  this.speed = {
    x: -5 + Math.random() * 10,
    y: -5 + Math.random() * 10
  };
  this.radius = 5 + Math.random() * 5;
  this.life = 30 + Math.random() * 10;
  this.remainingLife = this.life;
  this.draw = ctx => {
    if(this.remainingLife > 0
    && this.radius > 0) {
      ctx.beginPath();
      ctx.arc(this.startX, this.startY, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + this.rgbArray[0] + ',' + this.rgbArray[1] + ',' + this.rgbArray[2] + ", 1)";
      ctx.fill();
      this.remainingLife--;
      this.radius -= 0.25;
      this.startX += this.speed.x;
      this.startY += this.speed.y;
    }
  }
}
addParticleType(ExplodingParticle);


return {
  init,
  dises,
  createSimultaneousParticles,
  getDisObj,
  addParticleType
};
}));
