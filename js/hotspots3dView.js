define([
	"coreJS/adapt",
	"./renderer3dView",
	"libraries/threejs/three"
],
function(Adapt, SR3DView, THREE) {
	'use strict';

	var Hospots3DView = SR3DView.extend({

		className: 'hotspots3D',

		initialize: function() {

			SR3DView.prototype.initialize.call(this);
			if (this.isDebug) console.log("Hospots3DView.initialize()");

			this.hotSpot3DLoaderClass = ".hotspots3D-loader";
			this.hotspots3DPopupClass = ".hotspots3D-popup";
			this.hotspots3DMobilePopupClass = ".hotspots3D-mobile-popup";
			this.hotspots3DPopupCloseClass = ".hotspots3D-popup-close";
			this.hotspots3DPopupImageClass = ".hotspots3D-popup-image";
			this.hotspots3DPopupTitleClass = ".hotspots3D-popup-title";
			this.hotspots3DPopupBodyClass = ".hotspots3D-popup-body";

			this.$canvasContainer = null;
			this.hasSelectedItem = false;
			this.hotspotsData = [];		// json data
			this.hotspots3D = [];		// 3d data
			this.interesectingObjects = [];
			this.textures = {};			// hotspot textures
			this.raycaster = null;
			this.onTouchEvent = null;
			this.onMouseDownEvent = null;
			this.onMouseUpEvent = null;
			this.onMouseMoveEvent = null;



          },

		preRender: function() {

			SR3DView.prototype.preRender.apply(this);

			if (this.isDebug) console.log("Hospots3D.preRender()");

			if (!this.model.has("hotspotsTexture"))
				this.model.set('hotspotsTexture', './assets/hotspot.png');

			if (!this.model.has("hotspotsSelectedTexture"))
				this.model.set('hotspotsSelectedTexture', './assets/hotspot_selected.png');
		},

		postRender: function() {

			if (this.isDebug) console.log("Hospots3D.postRender()");

			SR3DView.prototype.postRender.apply(this);

			// show loader
			this.$(this.hotSpot3DLoaderClass).show();

			this.hotspotsData = [];		// json data
			this.hotspots3D = [];		// 3d data
			this.textures = {};			// hotspot textures
			this.raycaster = new THREE.Raycaster();

			// cache container
			this.$canvasContainer = this.$(this.canvasContainerClass);
		},

		postModelLoad: function() {
			SR3DView.prototype.postModelLoad.apply(this, arguments);
		},

		// triggered when 3D Model, Textures and Scene are loaded and created.
		onLoadingModelComplete: function() {

			SR3DView.prototype.onLoadingModelComplete.apply(this, arguments);
			if (this.isDebug) console.log("HotSpot3DView.onLoadingModelComplete()");

			this.setupEventListeners();

			this.hasSelectedItem = false;

			// check if there are any hotspots
			var hotspots = this.model.get('_items');
			if (hotspots.length === 0)
			{
				if (this.isDebug) console.log("No hotspots found, completed.");
				this.model.setCompletionStatus();
				return;
			}

			// we have hotspots
			this.setHotspots();
		},

		resetCamera: function() {
			this.onRendererMouseDown();

			SR3DView.prototype.resetCamera.apply(this);
		},

		setHotspots: function() {

			if (this.isDebug) console.log("HotSpot3DView.setHotspots");

			let self = this;
			let model = this.model;
			let hotspots = model.get('_items');
			let isComplete = model.get("_isComplete");
			let hotspotsCount = 0;		// index count

			this.textures = {
				'normal': {
					url: model.get('hotspotsTexture'),
					val: null
				},
				'selected': {
					url: model.get('hotspotsSelectedTexture'),
					val: null
				}
			};

			let myTextureArray = [];
			var textureManager = new THREE.LoadingManager();
				textureManager.onProgress = function ( item, loaded, total )
				{
					if (self.isDebug) console.log("***** Loading... " + item + ' = ' + loaded / total * 100) + '%';
				};
				textureManager.onLoad = function () {

					for (let key in self.textures)
					{
						let loadedTexture = myTextureArray[key];
						loadedTexture.name = key + "_texture";
						loadedTexture.needsUpdate  = true;

						if (self.isDebug) console.log('***** LoadedTexture:', loadedTexture);

						self.textures[key].val = loadedTexture;
					}

					let hotspotTexture = null;
					if (isComplete) hotspotTexture = self.textures.selected.val;
					else hotspotTexture = self.textures.normal.val;

					_.each(hotspots, function(hotspot) {
						self.hotspotsData.push(hotspot);

						let spriteMaterial = new THREE.SpriteMaterial({
							name: "hotspot_" + hotspotsCount + "_mat",
							map: hotspotTexture,
							color: 0xffffff
						});

						// if we want the hotspots to show allways on top
						// spriteMaterial.depthTest = false;
						// spriteMaterial.depthWrite = false;

						let hotspot3D = new THREE.Sprite(spriteMaterial);
						hotspot3D.index = hotspotsCount;
						hotspot3D.name = "hotspot" + (hotspotsCount + 1);
						hotspot3D.material.needsUpdate = true;

						if (Adapt.device.screenSize === 'small')
						{
							hotspot3D.scale.set(4 * this.hotspotScale, 4 * this.hotspotScale, 4* this.hotspotScale);
						}
						else hotspot3D.scale.set(2 * this.hotspotScale, 2 * this.hotspotScale, 2 * this.hotspotScale);


						let hotspotPosition = self.hotspotPositions[hotspot3D.name];
						hotspot3D.position.set(hotspotPosition.x, hotspotPosition.y, hotspotPosition.z);
						hotspot3D.image = hotspot.image;
						hotspot3D.title = hotspot.title;
						hotspot3D.body = hotspot.body;
						hotspot3D.isHotspot = true;
						hotspot3D.selected = isComplete;
						hotspot3D.visible = true;

						self.scene.add(hotspot3D);
						self.hotspots3D.push(hotspot3D);

						hotspotsCount++;
					}, self);

					myTextureArray = [];

					if (self.isDebug) console.log('Hotspots.LoadingManager completed');
					self.onHotSpotsLoaded();
				};

				if (self.isDebug) console.log('HotSpots.LoadingManager start');
				let textureLoader = new THREE.TextureLoader( textureManager );
				textureLoader.setCrossOrigin(undefined);

				for (let key in this.textures)
				{
					myTextureArray[key] = textureLoader.load( this.textures[key].url );
				}
		},

		// triggered when all laoding is completed
		onHotSpotsLoaded: function() {
 			if (this.isDebug) console.log("MediaExplorerView.onHotSpotsLoaded");

			// create array with intersecting objects
			this.interesectingObjects = _.clone(this.hotspots3D);
			this.interesectingObjects.push(this.meshModel);

			// hide loader icon
			this.$(this.hotSpot3DLoaderClass).hide();

			// set property, this will trigger MediaExplorer.onHotSpotViewLoaded()
			this.model.set("_isLoaded", true);
		},

		setupEventListeners: function() {

			this.listenTo(this.model.get('_children'), {
			    'change:_isActive': this.onItemsActiveChange,
			    'change:_isVisited': this.onItemsVisitedChange
			});

			this.onTouchEvent = _.bind(this.onRendererTouch, this);
			this.onMouseDownEvent = _.bind(this.onRendererMouseDown, this);
			this.onMouseUpEvent = _.bind(this.onRendererMouseUp, this);
			this.onMouseMoveEvent = _.bind(this.onRendererMouseMove, this);

			this.renderer.domElement.addEventListener('touchstart', this.onTouchEvent, false );
			this.renderer.domElement.addEventListener('mousedown', this.onMouseDownEvent, false);
			this.renderer.domElement.addEventListener('mouseup', this.onMouseUpEvent, false);
			this.renderer.domElement.addEventListener('mousemove', this.onMouseMoveEvent, false);
		},

		removeEventListeners: function() {

			this.stopListening(this.model.get('_children'), {
			    'change:_isActive': this.onItemsActiveChange,
			    'change:_isVisited': this.onItemsVisitedChange
			});

			this.renderer.domElement.removeEventListener('touchstart', this.onTouchEvent, false );
			this.renderer.domElement.removeEventListener('mousedown', this.onMouseDownEvent, false );
			this.renderer.domElement.removeEventListener('mouseup', this.onMouseUpEvent, false );
			this.renderer.domElement.removeEventListener('mousemove', this.onMouseOverEvent, false );

		},

		onItemsActiveChange: function(model, _isActive) {
		    if (this.isDebug) console.log("Hospots3DView.onItemsActiveChange._isActive", _isActive);
		},

		onItemsVisitedChange: function(model, _isVisited) {
		    if (this.isDebug) console.log("Hospots3DView.onItemsVisitedChange._isVisited", _isVisited);
		},

		onRendererTouch: function(event) {
			if (event) event.preventDefault();

			if (this.isDebug)  console.log("Hospots3DView.onRendererTouch.hasSelectedItem", this.hasSelectedItem);

			if (event.touches.length > 1
				|| (event.type == "touchend" && event.touches.length > 0)
				|| this.hasSelectedItem) return;

			let touch = null;
			let touchType = null;

			switch (event.type)
			{
				case "touchstart":
					touch = event.changedTouches[0];
					touchType = "onclick";
					break;
				case "touchmove":
					touchType = "mousemove";
					touch = event.changedTouches[0];
					break;
				case "touchend":
					touchType = "mouseup";
					touch = event.changedTouches[0];
					break;
			}

			if (touchType == "onclick")
			{
				let canvas = event.target;
				let rect = canvas.getBoundingClientRect();
				let offsetX = touch.clientX - rect.left;
				let offsetY = touch.clientY - rect.top;

				this.checkIfIntersected(offsetX, offsetY);
			}
		},

		onRendererMouseDown: function(event) {
			if (event) event.preventDefault();

			if (self.isDebug) console.log("onRendererMouseDown");
		},

		onRendererMouseUp: function(event) {
			if (event) event.preventDefault();

			if (self.isDebug) console.log("onRendererMouseUp");

			if (this.hasSelectedItem) return;

			this.checkIfIntersected(event.offsetX, event.offsetY);
		},

		onRendererMouseMove: function(event) {
			if (event) event.preventDefault();

			if (self.isDebug) console.log("onRendererMouseMove");

			if (this.hasSelectedItem) return;

			this.checkIfOverIntersected(event.offsetX, event.offsetY);
		},

		checkIfOverIntersected: function(offsetX, offsetY) {

			this.mouse.x = (offsetX / this.sceneWidth) * 2 - 1;
			this.mouse.y = -(offsetY / this.sceneHeight) * 2 + 1;

			let self = this;
			this.INTERSECTED = null;
			this.raycaster.setFromCamera(this.mouse, this.camera);

			// check hits against 3D model and hotspots - to avoid selecting hidden hotspots
			// blocked by model
			var intersectsWithModel = this.raycaster.intersectObjects(this.interesectingObjects);
			if (intersectsWithModel.length > 0 && intersectsWithModel[0].object.type == "Mesh")
			{
				this.$canvasContainer.css('cursor', 'default');
				return;
			}

			// check if we have a valid hotspot hit
			let intersects = this.raycaster.intersectObjects(this.hotspots3D);
			if (intersects.length > 0)
				this.INTERSECTED = intersects[0].object;
			else
				this.INTERSECTED = null;

			// if we have a valid hit, update the mouse cursor
			if (this.INTERSECTED)
				this.$canvasContainer.css('cursor', 'pointer');
			else
				this.$canvasContainer.css('cursor', 'default');
		},

		checkIfIntersected: function(offsetX, offsetY) {

			// initialize
			this.INTERSECTED = null;

			// reset cursor
			this.$(this.canvasContainerClass).css('cursor', 'default');

			// calculate mouse position
			this.mouse.x = (offsetX / this.sceneWidth) * 2 - 1;
			this.mouse.y = -(offsetY / this.sceneHeight) * 2 + 1;

			// update mouse and camera and check for ray hit
			this.raycaster.setFromCamera(this.mouse, this.camera);

			// check hits against 3D model and hotspots - to avoid selecting hidden hotspots
			// blocked by model
			var intersectsWithModel = this.raycaster.intersectObjects(this.interesectingObjects);
			if (intersectsWithModel.length > 0 && intersectsWithModel[0].object.type == "Mesh")
			{
				this.$canvasContainer.css('cursor', 'default');
				return;
			}

			// check for intersection hit
			let intersects = this.raycaster.intersectObjects(this.hotspots3D);
			if (intersects.length > 0)
				this.INTERSECTED = intersects[0].object;
			else
				this.INTERSECTED = null;

			// dont show popup
			if (!(this.INTERSECTED && this.INTERSECTED.title))
			{
				this.hasSelectedItem = false;
				return;
			}

			// if we are passed this point and have not completed, we will show popup
			// lets swap the hotspot sprite with its selected texture
			let isComplete = this.model.get("_isComplete");
			if (!isComplete)
			{
				if (this.isDebug)
					console.log("Hotspot Selected: ", this.INTERSECTED.index, ": ", this.INTERSECTED.name);

				this.hotspots3D[this.INTERSECTED.index].material.map = this.textures.selected.val;
				this.hotspots3D[this.INTERSECTED.index].material.needsUpdate = true;
				// this.hotspots3D[this.INTERSECTED.index].selected = true;

				// set item model active and visited
				this.model.getItem(this.INTERSECTED.index).toggleActive(true);
				this.model.getItem(this.INTERSECTED.index).toggleVisited(true);

				// check if all items completed
				if (this.model.areAllItemsCompleted())
				{
					if (this.isDebug) console.log("All hotspots selected and complete...");
					this.model.setCompletionStatus();
				}
			}

			// setup popup info
			let $popup = this.$(this.hotspots3DPopupClass);
			let $widget = this.$(this.canvasContainerClass);

			$popup.find(this.hotspots3DPopupImageClass).attr('src', this.INTERSECTED.image);
			$popup.find(this.hotspots3DPopupTitleClass).html(this.INTERSECTED.title);
			$popup.find(this.hotspots3DPopupBodyClass).html(this.INTERSECTED.body);

			// mark selected to disable touch, until user closes popup
			this.hasSelectedItem = true;
			this.disableCamera();
			this.model.set("_navigationControls", false);

			// we will only use small popup for large screens
			if (Adapt.device.screenSize != 'small' && !this.isMobile())
			{
				let directionX = (offsetX > $widget.outerWidth() / 2) ? 'right' : 'left';
				let directionY = (offsetY > $widget.outerHeight() / 2) ? 'bottom' : 'top';
				let popupX = (directionX == 'left') ? offsetX : $widget.outerWidth() - offsetX;
				let popupY = (directionY == 'top') ? offsetY : $widget.outerHeight() - offsetY;

				$popup.css(directionX, popupX);
				$popup.css(directionY, popupY);
				$popup.slideDown("fast");

				this.$(this.hotspots3DPopupCloseClass).on("click", this.onSmallPopupClose.bind(this));
			}
			else
			{
				// for mobile devices show notify popup
				this.openPopup();
			}
		},

		onSmallPopupClose: function(event) {
			if (event) event.preventDefault();

			this.model.set("_navigationControls", true);
			this.hasSelectedItem = false;
			this.enableCamera();

			this.removeSmallPopup();
		},

		removeSmallPopup: function() {

			let $popup = this.$(this.hotspots3DPopupClass);
			$popup.removeAttr('style');
			$popup.find(this.hotspots3DPopupImageClass).attr('src', "");
			$popup.find(this.hotspots3DPopupTitleClass).html("");
			$popup.find(this.hotspots3DPopupBodyClass).html("");

		},

		openPopup: function() {

			let promptObject = {
				title: "",
				body: this.$(this.hotspots3DPopupClass).html(),
				_classes: this.hotspots3DMobilePopupClass.substr(1),
				_showIcon: false
			}

			this.listenToOnce(Adapt, 'notify:closed', this.onPopupClosed, this);
			this.listenToOnce(Adapt, 'notify:cancelled', this.onPopupClosed, this);

			Adapt.trigger('notify:popup', promptObject);
		},

		onPopupClosed: function() {

			if (this.isDebug) console.log("onPopupClosed");

			this.hasSelectedItem = false;
			this.enableCamera();
			this.model.set("_navigationControls", true);
		},

		clearScene: function() {
			SR3DView.prototype.clearScene.apply(this);

			if (this.isDebug) console.log("**** 3DHotspots.clearScene()");

			// NOTE: All HOTSPOT sprites, materials and textures all removed in SR3DView
			this.removeEventListeners();

			let $popup = this.$(this.hotspots3DPopupClass);
			let $widget = this.$(this.canvasContainerClass);
			$popup.slideUp("fast");

			// clear hotspot references
			this.hotspots3D = [];
			this.hotspotsData = [];		// json data
			this.textures = {};			// hotspot textures
		},

		isLandscape: function() {
			let screenW = $(window).width();
			let screenH = $(window).height();
			return (screenW > screenH);
		},

		isIOS: function() {
			return ($(".os-ios").length > 0);
		},

		isAndroid: function() {
			return ($(".os-android").length > 0);
		},

		isMobile: function() {
			return (this.isIOS() || this.isAndroid());
		},

		onWindowResize: function () {
			SR3DView.prototype.onWindowResize.apply(this);

			// remove any small popups
			if (this.hasSelectedItem) {
				this.onSmallPopupClose();
			}
		},

		remove: function() {

			if (this.isDebug) console.log("HotSpots3DView.remove");

			this.clearScene();

			SR3DView.prototype.remove.apply(this);
		}
	}, {
		template: "hotspots3D"
	});

	return Hospots3DView;
});
