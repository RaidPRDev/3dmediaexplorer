define([
	"coreViews/componentView",
	"coreJS/adapt",
	"libraries/threejs/three",
	"libraries/threejs/FBXLoader",
	"libraries/threejs/HDRCubeTextureLoader",
	"libraries/threejs/pmrem/PMREMCubeUVPacker",
	"libraries/threejs/pmrem/PMREMGenerator",
	"libraries/threejs/OrbitControls",
	"libraries/threejs/Projector",
	"libraries/TweenLite.min"
],
function (ComponentView, Adapt, THREE) {

	var SR3DView = ComponentView.extend({
		events: {

		},

		preRemove: function () {

			// remove resizing event
			$(window).off("resize.rendererView");
		},

		initialize: function () {
			ComponentView.prototype.initialize.call(this);

			// Debug flag
			this.isDebug = (this.model.has('debug') && this.model.get('debug') === true);
			this.canvasContainerClass = ".hotspots3D-canvas-container";
			this.shouldRender = false;
			this.lastCameraPosition = null;
			this.lastControlPosition = null;
			this.animationFrameRequestUpdate = null;
			this.isLoading = false;
			this.hotspotPositions = null;
			this.hotspotScale = 1;
			this.meshModel = null;
			this.renderer = null;
			this.isIE = false;
			this.isMacSafari = false;
			this.clock = null;
			this.mixer = null;
			this.standardMaterial = null;
               this.initialCameraPosition = {};
               this.lastCameraPosition = {};

			if (this.isDebug) console.log("SR3DView.initialize()");
		},

		preRender: function () {

			if (this.isDebug) console.log("SR3DView.preRender()", this.model);

			// IE 11 detection
			this.isIE = (Object.hasOwnProperty.call(window, "ActiveXObject") && !window.ActiveXObject);
			this.isIE = (navigator.userAgent.match(/Trident\/7\./)) ? true : this.isIE;
			if (this.isDebug && this.isIE) console.log("Internet Explorer 11 detected", this.isIE);

			// Loading flags
			this.isReady = false;
			this.isLoading = true;
		},

		postRender: function () {

			if (this.isDebug) console.log("SR3DView.postRender()");

			// Grab TweenLite Library
			this.TweenLite = window.TweenLite;

			// Texture Loader Manager
			this.textureLoader = new THREE.TextureLoader();

			// initialize render scene settings
			this.loadRendererSettings();
			this.initializeRenderingScene();

			// add resizing event
			$(window).on("resize.rendererView", this.onWindowResize.bind(this));
		},

		loadRendererSettings: function () {
			// get renderer settings
			if (!this.model.has('zoomStart')) this.model.set('zoomStart', 1);
			if (!this.model.has('zoomAmount')) this.model.set('zoomAmount', 10);
			if (!this.model.has('ambientColor')) this.model.set('ambientColor', "#444444");
			if (!this.model.has('ambientLight')) this.model.set('ambientLight', 1);
			if (!this.model.has('backgroundColor')) this.model.set('backgroundColor',"#3a3a3a");

			// setup renderer
			if (this.isDebug) console.log("Setting up WebGL Renderer");
			this.renderer = new THREE.WebGLRenderer({
				antialias: true
			});
			this.renderer.setPixelRatio(window.devicePixelRatio);
			this.renderer.autoClear = false; // To allow render overlay on top of sprited sphere
		},

		isHighResolutionTextureSupported: function () {
			const gl = this.renderer.domElement.getContext("experimental-webgl");
			if (this.isDebug) console.log("GL_MAX_TEXTURE_SIZE:", gl.getParameter(gl.MAX_TEXTURE_SIZE));
			return (gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 2048);
		},

		isUltraHighResolutionTextureSupported: function () {
			const gl = this.renderer.domElement.getContext("experimental-webgl");
			return (gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096);
		},

		reloadScene: function (hotspots3DModel) {
			this.model = hotspots3DModel.clone();

			// set loading flag
			this.isLoading = true;

			// re-initialize rendering scene
			this.loadRendererSettings();
			this.initializeRenderingScene();
		},

		initializeRenderingScene: function () {

			const self = this;

			// create scene
			this.scene = new THREE.Scene();

			// get background image for 3D scene
			const textureName = this.getTexturePath() + this.model.get("background3d");

			// Mac Safari has a 3D composition bug that they need to fix
			// to remedy this check for Safari Mac and bypass background texture
			// we will just set the color instead.
			const ua = navigator.userAgent.toLowerCase();
			if (ua.indexOf('safari') !== -1) {
				if (ua.indexOf('macintosh') !== -1) {
					// on Mac Safari
					if (self.isDebug) console.log("ON MAC SAFARI");
					this.isMacSafari = true;
				}
			}

			if (!this.isMacSafari && this.model.has("background3d")) {
				// load background image
				const textureMap = this.textureLoader.load(
					textureName,
					function (texture) {
						texture.name = textureName;
						if (self.isDebug) console.log("Background name:", texture.name, "texture:", texture);
						self.scene.background = texture;
						self.loadFBX();
					},
					// onProgress callback currently not supported
					undefined,
					// onError callback
					function (err) {
						console.error('There was an error loading ' + textureName, err);
					}
				);
			} else {
				if (self.isDebug) console.log("Bypassing background texture, setting color instead");

				let bg3DColor;
				if (this.model.has("backgroundColor"))
					bg3DColor = new THREE.Color(this.model.get("backgroundColor"));
				else
					bg3DColor = new THREE.Color("#111111");

				this.scene.background = bg3DColor;
				this.loadFBX();
			}
		},

		loadFBX: function () {

			// get dom element and get its size
			const $container = this.$el.find(this.canvasContainerClass);
			this.sceneWidth = $container.outerWidth();
			this.sceneHeight = $container.outerHeight();

			if (this.isDebug) {
				console.log("Setting Scene");
				console.log('Viewport Size: w:', this.sceneWidth, 'h:', this.sceneHeight);
			}

			// create camera and set initial zoom
			this.camera = new THREE.PerspectiveCamera(45, this.sceneWidth / this.sceneHeight, 1, 2000);
			this.camera.zoom = this.model.get("zoomStart");

			// create an environment ambient light
			const ambientColor = new THREE.Color(this.model.get("ambientColor"));
			const ambientLight = new THREE.AmbientLight(ambientColor.getHex(), this.model.get("ambientLight"));
			this.scene.add(ambientLight);

			// debug ground
			if (this.isDebug) {
				const mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2000, 2000), new THREE.MeshPhongMaterial({
					color: 0x999999,
					depthWrite: false
				}));
				mesh.rotation.x = -Math.PI / 2;
				mesh.receiveShadow = false;
				mesh.material.lights = false;
				this.scene.add(mesh);

				const grid = new THREE.GridHelper(2000, 50, 0x000000, 0x000000);
				grid.material.opacity = 0.2;
				grid.material.transparent = true;
				mesh.material.lights = false;
				this.scene.add(grid);
			}

			// init hotspot positions array for 3D HotSpots
			this.hotspotPositions = [];

			// set clock for animation
			this.clock = new THREE.Clock();

			// RENDERER INIT

			if (this.isDebug) console.log("Setting up OrbitControls");
			this.mouse = new THREE.Vector2();
			this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
			this.controls.enableZoom = false;
			this.controls.panSpeed = 0.1; // smooth out speeds
			this.controls.rotateSpeed = 0.1; // smooth out speeds
			this.controls.enableDamping = true;
			this.controls.dampingFactor = 0.25;
			this.controls.screenSpacePanning = true; // the camera pans in screen space.
			this.controls.update();

			// conversion from inches to SI meters
			const meters = 2.54;
			const self = this;

			const loader = new THREE.FBXLoader();
			loader.load(this.model.get('model'), function (sceneItem) {

				if (self.isDebug) console.log("Starting FBX Processing");

				// check if we have animations
				if (self.model.get("hasAnimation")) {
					self.mixer = new THREE.AnimationMixer(sceneItem);
					const action = mixer.clipAction(sceneItem.animations[0]);
					action.play();
				}

				sceneItem.traverse(function (object) {

					if (object.isGroup) {
						if (object.name.indexOf("hotspot") !== -1) {
							object.scale.set(object.scale.x / meters, object.scale.y / meters, object.scale.z / meters);
							object.position.set(object.position.x / meters, object.position.y / meters, object.position.z / meters);
							self.hotspotPositions[object.name] = object.position;

							if (self.isDebug) {
								//console.log("HOTSPOT:", object);
								console.log("HOTSPOT.name:", object.name, "position:", object.position);
								const geometry = new THREE.BoxGeometry(2, 2, 2);
								const material = new THREE.MeshBasicMaterial({
									color: 0x00ff00
								});
								const cube = new THREE.Mesh(geometry, material);
								cube.position.set(object.position.x, object.position.y, object.position.z);
								const box = new THREE.BoxHelper(cube, 0xffff00);
								self.scene.add(box);
							}
						}
					} else {
						if (object.isMesh) {

							self.meshModel = object;

							if (self.isDebug) console.log("MESH.name:", object.name);
							if (self.standardMaterial) object.material = self.standardMaterial;

							object.scale.set(object.scale.x / meters, object.scale.y / meters, object.scale.z / meters);
							object.position.set(object.position.x / meters, object.position.y / meters, object.position.z / meters);

							if (self.isDebug) console.log("object.material:", object.material);

							if (self.model.get("texture") !== undefined) {
								if (self.isDebug) console.log("Loading Diffuse Map:", self.model.get("texture"));

								let diffuseTexture = self.getTexturePath() + self.model.get("texture");
								object.material.map = self.textureLoader.load(diffuseTexture);
							} else console.error("Renderer[No texture map found]");

							if (self.model.get("textureBump") !== undefined) {
								if (self.isDebug) console.log("Loading Bump Map:", self.model.get("textureBump"));

								let bumpTexture = self.getTexturePath() + self.model.get("textureBump");
								object.material.bumpMap = self.textureLoader.load(bumpTexture);

								if (self.model.get("bumpScale") !== undefined) {
									if (self.isDebug) console.log("Ading Bump Scale:", self.model.get("bumpScale"));
									let bumpScale = self.model.get("bumpScale");
									// reduce for IE 11
									if (self.isIE) bumpScale -= 0.5;

									object.material.bumpScale = bumpScale;
								}
							}

							object.material.specular = new THREE.Color(0x20202);
							object.material.shininess = 75;
						}

						if (object.isCamera)
						{
							if (self.isDebug) console.log("CAMERA: name:", object.name);

							self.camera.scale.set(object.scale.x / meters, object.scale.y / meters, object.scale.z / meters);
							self.camera.position.set(object.position.x / meters, object.position.y / meters, object.position.z / meters);

							if (object.children.length > 0) {
								const xPadding = 0;
								const yPadding = 0;
								self.controls.target.set((object.children[0].position.x / meters) - xPadding, (object.children[0].position.y / meters) - yPadding, object.children[0].position.z / meters);
								if (self.isDebug) console.log("CAMERA.Target.position:", self.controls.target);
								self.controls.update();
							}

							self.camera.fov = object.fov;
							self.camera.updateProjectionMatrix();
							self.controls.saveState();

						}

						if (object.isLight)
						{
							if (self.isDebug)
							{
								console.log("LIGHT.name:", object.name);
								const helper = new THREE.PointLightHelper(object, 5, 0xff0000);
								helper.position.set(object.position.x / meters, object.position.y / meters, object.position.z / meters);
								helper.name = "PointLightHelper";
								self.scene.add(helper);
							}

							object.position.set(object.position.x / meters, object.position.y / meters, object.position.z / meters);
						}
					}
				});

				if (self.isDebug) console.log("FBX Processing Completed");
				self.scene.add(sceneItem);
				self.onLoadingModelComplete();
			});


			if (this.isDebug) console.log("Setting up Rendering Viewport");
			this.renderer.setSize(this.sceneWidth, this.sceneHeight);
			this.renderer.shadowMap.enabled = true;
			$container.append(this.renderer.domElement);

			if (this.isDebug) console.log("Staring Animation Loop");
			this.isReady = this.shouldRender = true;
			this.handleRender();
		},

		getTexturePath: function () {

			let texturePath = this.model.get('texturePath');

			// default large = 2048x2048
			let resolution = "large";

			// check if we can even use high res texture sizes
			if (this.isHighResolutionTextureSupported()) {
				// set texture quality
				resolution = Adapt.device.screenSize;

				if (this.isUltraHighResolutionTextureSupported())
					resolution = "ultra";

				// force quality
				if (this.model.has("textureQuality"))
					resolution = this.model.get("textureQuality");

				// force small resolution for IE 11
				if (this.isIE) resolution = "small";
			} else {
				if (this.isDebug)
					console.log("Hi-res textures is not supported. Forcing to low-res textures.");

				resolution = "small";
			}

			switch (resolution) {
				case 'small':
					// 512x512
					texturePath += "small/";
					break;
				case 'medium':
				case 'large':
					// 2048x2048
					texturePath += "high/";
					break;
				case 'ultra':
					// 4096x4096
					texturePath += "ultra/";
					break;

			}

			if (this.isDebug) console.log("texturePath", texturePath);

			return texturePath;
		},

		handleRender: function () {
			if (!this.isReady || !this.shouldRender) return;
			this.render3D();
			this.animationFrameRequestUpdate = requestAnimationFrame(_.bind(this.handleRender, this));
		},

		render3D: function () {
			if (this.mixer) this.mixer.update(this.clock.getDelta());
			this.renderer.render(this.scene, this.camera);
			// stats.update();
		},

		onLoadingModelComplete: function () {
			if (this.isDebug) console.log("Renderer3DView.onLoadingModelComplete");

			this.isLoading = false;

               // save initial camera positon and target
               this.initialCameraPosition = {};
               this.initialCameraPosition.position = this.camera.position.clone();
               this.initialCameraPosition.rotation = this.camera.rotation.clone();
               this.initialCameraPosition.controlCenter = this.controls.target.clone();
		},

		onWindowResize: function () {
			if (this.isDebug) console.log("Renderer3DView.onWindowResize");
			
			const $container = this.$el.find(this.canvasContainerClass);
			this.sceneWidth = $container.outerWidth();
			this.sceneHeight = $container.outerHeight();

			this.camera.aspect = this.sceneWidth / this.sceneHeight;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(this.sceneWidth, this.sceneHeight);
		},

		getTranslatedVector: function (object, axis, distance) {
			const quaternion = object.quaternion;
			const vector = new THREE.Vector3();

			axis.applyQuaternion(quaternion);
			vector.copy(object.position);
			vector.add(axis.multiplyScalar(distance));

			return vector;
		},

		enableCamera: function () {
               // enable orbit controls
               this.controls.enabled = true;

               // restore current state position
               this.controls.reset();
		},

		disableCamera: function () {
               // save current state position
               this.controls.saveState();

               // disable orbit controls
			this.controls.enabled = false;
		},

          eventFire: function(el, etype) {
               if (el.fireEvent) {
                    el.fireEvent('on' + etype);
               } else {
                    console.log("FIRED");
                    var evObj = document.createEvent('Events');
                    evObj.initEvent(etype, true, false);
                    el.dispatchEvent(evObj);
               }
          },

          // resets camera to initial cam position
		resetCamera: function () {

               this.restoreCamera(
                    this.initialCameraPosition.position,
                    this.initialCameraPosition.rotation,
                    this.initialCameraPosition.controlCenter
               );
		},

          // save last camera position
          saveCamera: function() {
               this.lastCameraPosition.position = this.camera.position.clone();
               this.lastCameraPosition.rotation = this.camera.rotation.clone();
               this.lastCameraPosition.controlCenter = this.controls.target.clone();

          },

          // set camera position
          restoreCamera: function(position, rotation, controlCenter) {
               this.camera.position.set(position.x, position.y, position.z);
               this.camera.rotation.set(rotation.x, rotation.y, rotation.z);
               this.controls.center.set(controlCenter.x, controlCenter.y, controlCenter.z);
               this.controls.update();
          },

		onZoomIn: function () {
			const zoomAmount = this.model.get('zoomAmount');
			const vectorMovement = new THREE.Vector3(0, 0, 1);
			const toPos = this.getTranslatedVector(this.camera, vectorMovement, -zoomAmount);

			if (this.isDebug) {
				console.log("onZoomInClick.zoomLength: ", zoomAmount);
				console.log("onZoomInClick.toPos.z: ", toPos.z);
			}

			this.animateCameraTo(toPos, .5);
		},

		onZoomOut: function () {
			const zoomAmount = this.model.get('zoomAmount');
			const vectorMovement = new THREE.Vector3(0, 0, 1);
			const toPos = this.getTranslatedVector(this.camera, vectorMovement, zoomAmount);

			if (this.isDebug) {
				console.log("onZoomInClick.zoomAmount: ", zoomAmount);
				console.log("onZoomInClick.toPos.z: ", toPos.z);
			}

			this.animateCameraTo(toPos, .5);
		},

		animateCameraTo: function (position, duration) {
			this.TweenLite.to(this.camera.position, duration, {
				x: position.x,
				y: position.y,
				z: position.z
			});
		},

		clearScene: function () {

			if (this.isDebug) console.log("Renderer.clearScene()");

			this.isReady = false;
			this.shouldRender = false;

			if (this.renderer instanceof THREE.WebGLRenderer) this.renderer.clearDepth();

			cancelAnimationFrame(this.animationFrameRequestUpdate);

			// scene cleanup
			let objectsInScene = [];

			// grab a hold of all the scene objects
			this.scene.traverse(function (child) {
				objectsInScene.push(child);
			});

			if (this.isDebug) console.log("objectsInScene.Count: " + objectsInScene.length);

			// now iterate through all the scene objects and its children
			// check for meshes, materials and geometry data and dispose
			// hopefully gc will kick in sooner rather than later...
			for (let i = 0; i < objectsInScene.length; i++) {
				if (this.isDebug) console.log("Removing " + objectsInScene[i].name);

				this.scene.remove(objectsInScene[i]);

				if (objectsInScene[i].isMesh) // dispose mesh geometry and materials
				{
					if (this.isDebug) console.log(objectsInScene[i]);

					if (objectsInScene[i].geometry instanceof Array) {
						// does it have more than (1) geometry
						let geoLen = objectsInScene[i].geometry.length;
						if (geoLen > 0) {
							for (let gIndex = 0; gIndex < geoLen; gIndex++) {
								let geoChild = objectsInScene[i].geometry.children[gIndex];
								if (this.isDebug) console.log("Removing Geometry: " + geoChild.name);
								geoChild.dispose();
							}
						}
					} else {
						if (this.isDebug) console.log("Removing Geometry: " + objectsInScene[i].geometry.name);
						objectsInScene[i].geometry.dispose();
					}

					// does it have more than (1) material
					if (objectsInScene[i].material instanceof Array) {
						let matLen = objectsInScene[i].material.length;
						if (matLen > 0) {
							for (let mIndex = 0; mIndex < matLen; mIndex++) {
								let matChild = objectsInScene[i].material[mIndex];
								if (this.isDebug) console.log("Removing Material: " + matChild.name);
								matChild.dispose();

								let mapChild = matChild.map;
								if (mapChild instanceof THREE.Texture) {
									if (this.isDebug) console.log("Removing Texture: " + mapChild.name);
									mapChild.dispose();
								}

								let bumpmapChild = objectsInScene[i].material.bumpmap;
								if (bumpmapChild instanceof THREE.Texture) {
									if (this.isDebug) console.log("Removing Bump Texture: " + bumpmapChild.name);
									bumpmapChild.dispose();
								}
							}
						}
					} else {
						if (this.isDebug) console.log("Removing Material: " + objectsInScene[i].material.name);
						objectsInScene[i].material.dispose();

						let map = objectsInScene[i].material.map;
						if (map instanceof THREE.Texture) {
							if (this.isDebug) console.log("Removing Texture: " + map.name);
							map.dispose();
						}

						let bumpmap = objectsInScene[i].material.bumpmap;
						if (bumpmap instanceof THREE.Texture) {
							if (this.isDebug) console.log("Removing Bump Texture: " + bumpmap.name);
							bumpmap.dispose();
						}
					}
				} else if (objectsInScene[i].isSprite) // dispose mesh geometry and materials
				{
					if (this.isDebug) console.log("Removing Sprite Material: " + objectsInScene[i].material.name);
					objectsInScene[i].material.dispose();

					let map = objectsInScene[i].material.map;
					if (map instanceof THREE.Texture) {
						if (this.isDebug) console.log("Removing Sprite Texture: " + map.name);
						map.dispose();
					}
				}
			}

			objectsInScene = [];

			// dispose standard material
			if (this.standardMaterial) {
				if (this.standardMaterial.map)
					this.standardMaterial.map.dispose();

				if (this.standardMaterial.bumpmap)
					this.standardMaterial.bumpmap.dispose();

				this.standardMaterial = null;
			}
		},

		displaySceneContents: function () {

			// scene cleanup
			let objectsInScene = [];

			// grab a hold of all the scene objects
			this.scene.traverse(function (child) {
				objectsInScene.push(child);
			});

			if (this.isDebug) console.log("objectsInScene.Count: " + objectsInScene.length);

			// now iterate through all the scene objects and its children
			// check for meshes, materials and geometry data and dispose
			// hopefully gc will kick in sooner rather than later...
			for (let i = 0; i < objectsInScene.length; i++) {
				if (this.isDebug) console.log("ObjectName:", objectsInScene[i].name);

				if (objectsInScene[i].isMesh) // dispose mesh geometry and materials
				{
					if (this.isDebug) console.log(objectsInScene[i]);

					if (objectsInScene[i].geometry instanceof Array) {
						// does it have more than (1) geometry
						let geoLen = objectsInScene[i].geometry.length;
						if (geoLen > 0) {
							for (let gIndex = 0; gIndex < geoLen; gIndex++) {
								let geoChild = objectsInScene[i].geometry.children[gIndex];
								if (this.isDebug) console.log("Geometry: " + geoChild.name);
							}
						}
					} else {
						if (this.isDebug) console.log("Geometry: " + objectsInScene[i].geometry.name);
					}

					// does it have more than (1) material
					if (objectsInScene[i].material instanceof Array) {
						let matLen = objectsInScene[i].material.length;
						if (matLen > 0) {
							for (let mIndex = 0; mIndex < matLen; mIndex++) {
								let matChild = objectsInScene[i].material[mIndex];
								if (this.isDebug) console.log("Material: " + matChild.name);

								let mapChild = matChild.map;
								if (mapChild instanceof THREE.Texture) {
									if (this.isDebug) console.log("Texture: " + mapChild.name);
								}
							}
						}
					} else {
						if (this.isDebug) console.log("Material: " + objectsInScene[i].material.name);

						let map = objectsInScene[i].material.map;
						if (map instanceof THREE.Texture) {
							if (this.isDebug) console.log("Texture: " + map.name);
						}
					}
				} else if (objectsInScene[i].isSprite) // dispose mesh geometry and materials
				{
					if (this.isDebug) console.log("Sprite Material: " + objectsInScene[i].material.name);

					let map = objectsInScene[i].material.map;
					if (map instanceof THREE.Texture) {
						if (this.isDebug) console.log("Sprite Texture: " + map.name);
					}
				}
			}

			objectsInScene = [];
		},

		logCameraPosition: _.debounce(function () {
			// console.log("Latest camera position", this.camera.position);
		}, 500)
	});

	return SR3DView;
});
