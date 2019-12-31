define([
	'core/js/adapt',
	'core/js/views/componentView',
	'core/js/models/itemsComponentModel',
	'./hotspots3dView'
], function (Adapt, ComponentView, ItemsComponentModel, HotSpots3DView) {
	'use strict';

	var MediaExplorerView = ComponentView.extend({

		events: {
			'click .media-control-play': 'onPlayClicked',
			'click .media-control-previous': 'onPreviousClicked',
			'click .media-control-reset': 'onResetClicked',
			'click .media-control-zoom-out': 'onZoomOutClicked',
			'click .media-control-zoom-in': 'onZoomInClicked',
			'click .media-control-next': 'onNextClicked'
		},

		initialize: function () {
			ComponentView.prototype.initialize.call(this);

			this.setUpViewData();
			this.setUpModelData();
			this.setUpEventListeners();
			this.checkIfResetOnRevisit();
		},

		setUpViewData: function () {
			// render view
			this.hotSpot3DView = null;

			// controls
			this.playButtonClass = ".media-control-play";
			this.prevButtonClass = ".media-control-previous";
			this.nextButtonClass = ".media-control-next";
			this.zoomInButtonClass = ".media-control-zoom-in";
			this.zoomOutButtonClass = ".media-control-zoom-out";
			this.resetButtonClass = ".media-control-reset";
		},

		setUpModelData: function () {
			this.isDebug = (this.model.has('debug') && this.model.get('debug'));
			this.model.set("currentIndex", 0);
			this.model.set("currentType", -1);
		},

		setUpEventListeners: function () {
			// only set events if isComplete is false
			// we have not completed this component
			if (!this.model.isComplete())
			{
				this.listenTo(Adapt, 'device:changed', this.onDeviceChanged);

				this.listenTo(this.model, {
					'change:_isSubmitted': this.onSubmittedChange

				});

				this.listenTo(this.model.get('_children'), {
					'change:_isActive': this.onItemsActiveChange,
					'change:_isVisited': this.onItemsVisitedChange,
					'change:_isComplete': this.onItemsCompleteChange

				});
			}
		},

		// triggered when _isSubmitted has changed
		onSubmittedChange: function(model, _isSubmitted) {
			if (_isSubmitted) this.$el.addClass("submitted");
          },

		checkIfResetOnRevisit: function () {
			var isResetOnRevisit = this.model.get('_isResetOnRevisit');

			// If reset is enabled set defaults
			if (isResetOnRevisit) {
				this.model.reset(isResetOnRevisit);
			}
		},

		// triggered when device orientation or size has changed
		onDeviceChanged: function () {},

		postRender: function () {

			this.$('.mediaexplorer3D-widget').imageready(this.setReadyStatus.bind(this));
			if (this.model.get('_setCompletionOn') === 'inview') {
				this.setupInviewCompletion('.component-widget');
			}

			// disable all controls at start up
			this.disableAllControls();

			// check if we already submitted
			if (this.model.isComplete())
			{
				this.onSubmittedChange(null, true);
			}
		},

		navigateToMedia: function () {

			if (this.hotSpot3DView) {
				this.hotSpot3DView.model.reset({silent:true});
				this.hotSpot3DView.remove();
			}

			// disable all controls at start up
			this.disableAllControls();

			// update navigation controls
			this.evaluateNavigation();

			// create hotspots
			this.createHotSpots3DView();
		},

		createHotSpots3DView: function () {

			let newModel = this.prepareHotSpots3DModel();
			newModel.init();
			this.hotSpot3DView = new HotSpots3DView({
				model: newModel
			});

			var $container = this.$(".mediaexplorer3D-container");
			$container.prepend(this.hotSpot3DView.$el);

			// capture current item when completed
			this.listenTo(newModel, {
				'change:_isComplete': this.onHotSpotItemsCompleteChange,
				'change:_isLoaded': this.onHotSpotViewLoaded,
				'change:_navigationControls': this.onNavigationControl
			});
		},

		// initializes hotspotview item model
		prepareHotSpots3DModel: function () {

			if (this.isDebug) console.log("MediaExplorerView.prepareHotSpots3DModel()");
			let itemModel = this.model.getItem(this.model.get("currentIndex"));

			let newHotSpots3DModel = {
				debug: this.isDebug,
				texturePath: this.model.get("texturePath"),
				hotspotsTexture: this.model.get("hotspotsTexture"),
				hotspotsSelectedTexture: this.model.get("hotspotsSelectedTexture"),
				model: itemModel.get("model"),
				texture: itemModel.get("texture"),
				background3d: itemModel.get("background3d"),
				backgroundColor: itemModel.get("backgroundColor"),
				ambientLight: itemModel.get("ambientLight"),
				ambientColor: itemModel.get("ambientColor"),
				zoomStart: itemModel.get("zoomStart"),
				zoomAmount: itemModel.get("zoomAmount"),
				_isComplete: this.model.get("_isComplete"),
				_items: itemModel.get("_items"),
				_navigationControls: true,
				_isLoaded: false,
			};

			return new ItemsComponentModel(newHotSpots3DModel);
		},

		// fires when hotspotview is fully loaded
		// trigger: change:_isComplete
		onHotSpotItemsCompleteChange: function (itemModel, _isComplete) {
			if (this.isDebug) console.log("onHotSpotItemsCompleteChange.itemModel", itemModel);

			// set hotspotview model to mediaExplorer items model
			// we will set visited and completed states
			this.model.setCompletedItems(itemModel);

			// check/update our navigation controls
			this.evaluateNavigation();
		},

		// fires when hotspotview is fully loaded
		// trigger: change:_isLoaded
		onHotSpotViewLoaded: function (model, _isLoaded) {
			if (this.isDebug) console.log("MediaExplorerView.onHotSpotViewLoaded.model", model);

			// once hotspots view is loaded
			// enable all controls and evaluate navigation
			this.enableAllControls();
			this.evaluateNavigation();
		},

		// enables/disables navigation controls via item model change
		// trigger: change:_navigationControls
		onNavigationControl: function(model, _navigationControls) {

               if (!_navigationControls)
               {
                    this.disableAllControls();
                    return;
               }

               // we are enabling controls
               this.enableAllControls();
               this.evaluateNavigation();

          },

		// triggers when a hotspot is clicked and active is set
		onItemsActiveChange: function (model, _isActive) {
			//console.log("MediaExplorerView.onItemsActiveChange");
		},

		// triggers when all hotspotview items are clicked and isComplete is set
		onItemsCompleteChange: function (model, _isComplete) {
			//console.log("MediaExplorerView.onItemsCompleteChange", model);
		},

		// triggers when a hotspotview item _isVisited is set
		onItemsVisitedChange: function (model, _isVisited) {
			//console.log("MediaExplorerView.onItemsVisitedChange");
		},

		enableAllControls: function () {
			this.$(".media-control").removeClass("disabled");
			this.$(".media-control").attr("aria-disabled", false);
		},

		disableAllControls: function () {
			this.$(".media-control").removeClass("disabled").addClass("disabled");
			this.$(".media-control").attr("aria-disabled", true);
		},

		// checks the current scenario and updates the navigation controls accordingly
		evaluateNavigation: function () {

			// check for global navigation locked
			if (this.model.has("isNaviationLocked") && this.model.get("isNaviationLocked")) {
				this.enableAllControls();
				return;
			}

			let currentIndex = this.model.get("currentIndex");
			let currentItemModel = this.model.getItem(currentIndex);

			// get the next and previous items to determine nav controls
			let prevItemModel = this.model.getItem(currentIndex - 1);
			let nextItemModel = this.model.getItem(currentIndex + 1);

			// check if current item is complete and next item is available
			if (currentItemModel.get("_isComplete") && nextItemModel) {
				// enable next button
				this.$(this.nextButtonClass).removeClass("disabled");
				this.$(this.nextButtonClass).attr("aria-disabled", false);
			} else {
				// if current item is not completed
				// disable next button
				if (!this.$(this.nextButtonClass).hasClass("disabled"))
				{
					this.$(this.nextButtonClass).addClass("disabled");
					this.$(this.nextButtonClass).attr("aria-disabled", true);
				}

			}

			// check if previous item is available
			if (prevItemModel) {
				// enable next button
				this.$(this.prevButtonClass).removeClass("disabled");
				this.$(this.prevButtonClass).attr("aria-disabled", false);
			} else {
				// disable prev button
				if (!this.$(this.prevButtonClass).hasClass("disabled"))
				{
					this.$(this.prevButtonClass).addClass("disabled");
					this.$(this.prevButtonClass).attr("aria-disabled", true);
				}

			}
		},

		// first play click
		onPlayClicked: function (event) {
			if (event) event.preventDefault();

			// hit play button
			this.$(".media-control-play").hide();

			// create new item view
			this.navigateToMedia();
		},

		onPreviousClicked: function (event) {
			if (event) event.preventDefault();

			let currentIndex = this.model.get("currentIndex");
			if (currentIndex > 0) {
				currentIndex--;
				this.model.set("currentIndex", currentIndex);
				this.navigateToMedia();
			}
		},

		onNextClicked: function (event) {
			if (event) event.preventDefault();

			let currentIndex = this.model.get("currentIndex");
			let childrenCount = this.model.getChildren().length;
			if (currentIndex < childrenCount - 1) {
				currentIndex++;
				this.model.set("currentIndex", currentIndex);
				this.navigateToMedia();
			}
		},

		// resets 3D Camera to its initial position
		onResetClicked: function (event) {
			if (event) event.preventDefault();

			if (this.hotSpot3DView) {
				this.hotSpot3DView.resetCamera();
			}
		},

		onZoomOutClicked: function (event) {
			if (event) event.preventDefault();

			if (this.hotSpot3DView) {
				this.hotSpot3DView.onZoomOut();
			}
		},

		onZoomInClicked: function (event) {
			if (event) event.preventDefault();

			if (this.hotSpot3DView) {
				this.hotSpot3DView.onZoomIn();
			}
		},

		// fired before view is removed
		preRemove: function() {
			this.stopListening(this.model, {
				'change:_isComplete': this.onComponentCompleteChange,
				'change:_isSubmitted': this.onSubmittedChange
			});
			this.stopListening(this.model.get('_children'), {
				'change:_isActive': this.onItemsActiveChange,
				'change:_isVisited': this.onItemsVisitedChange,
				'change:_isComplete': this.onItemsCompleteChange

			});
		}
	});

	return MediaExplorerView;
});
