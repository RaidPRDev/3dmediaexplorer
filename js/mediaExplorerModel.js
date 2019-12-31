define([
	'core/js/adapt',
	'core/js/models/itemsComponentModel'
], function (Adapt, ItemsComponentModel) {

	var MediaExplorerItemsModel = ItemsComponentModel.extend({

		// Used to set model defaults
		defaults: function() {
		    // Extend from the ComponentModel defaults
		    return ItemsComponentModel.resultExtend("defaults", {
			   _isQuestionType: true,
			   _isSubmitted: false,
			   _questionWeight: Adapt.config.get("_questionWeight"),
		    });
		},

		// Extend from the ComponentModel trackable
          trackable: ItemsComponentModel.resultExtend("trackable", [
              '_isSubmitted',
              '_score',
              '_isCorrect'
          ]),

		init: function () {
			if (this.get("debug")) console.log("MediaExplorerItemsModel.init");

			this.listenToOnce(Adapt, "adapt:initialize", this.onAdaptInitialize);

			ItemsComponentModel.prototype.init.call(this);
		},

		// Used to add post-load changes to the model
          onAdaptInitialize: function() {
			this.restoreUserAnswers();
          },

		restoreUserAnswers: function () {
			if (this.get("debug")) console.log("MediaExplorerItemsModel.restoreUserAnswers");

			if (!this.get('_isSubmitted')) return;

			var itemModels = this.getChildren();
			var userAnswer = this.get('_userAnswer');

			itemModels.each(function (item, index) {
				item.toggleVisited(true);
				item.set("_isComplete", true);
			});

			if (this.get("debug")) console.log("MediaExplorerItemsModel.storeUserAnswer.userAnswer", userAnswer);

			this.setQuestionAsSubmitted();
			this.setScore();
		},

		// This is important for returning or showing the users answer
		// This should preserve the state of the users answers
		storeUserAnswer: function () {
			if (this.get("debug")) console.log("MediaExplorerItemsModel.storeUserAnswer");

			var items = this.getChildren().slice(0);
			items.sort(function (a, b) {
				return a.get('_index') - b.get('_index');
			});

			var userAnswer = items.map(function (itemModel) {
				return itemModel.get('_index');
			});

			this.set('_userAnswer', userAnswer);

			if (this.get("debug")) console.log("MediaExplorerItemsModel.storeUserAnswer.userAnswer", userAnswer);
		},

		// Used to set _isSubmitted on the model
		setQuestionAsSubmitted: function() {
			this.set({
				_isSubmitted: true
			});
          },

		// called by spoor for _shouldRecordInteractions
		isCorrect: function () {
			return true;
		},

		// Sets the score based upon the questionWeight
		setScore: function () {
			var questionWeight = this.get('_questionWeight');
			this.set('_score', questionWeight);
		},

		resetUserAnswer: function () {
			this.set('_userAnswer', []);
		},

		setCompletedItems: function (itemModel) {
			let currentIndex = this.get("currentIndex");
			let item = this.getItem(currentIndex);

			item.toggleActive(true);
			item.toggleVisited(true);
			item.set("_isComplete", true);

			if (this.areAllItemsCompleted()) {
				if (this.get("debug")) console.log("MediaExplorerItemsModel.setCompletedItems()");
				// this.checkCompletionStatus();
				this.setCompletionStatus();
				this.setQuestionAsSubmitted();
				this.storeUserAnswer();
				this.setScore();
			}
		},

		resetItems: function () {
			this.resetActiveItems();
		},

		isComplete: function() {
			return this.get('_isComplete');
		},

		/**
           * Used to determine whether the learner is allowed to interact with the question component or not.
           * @return {Boolean}
           */
          isInteractive: function() {
              return !this.get('_isComplete') || (this.get('_isEnabled') && !this.get('_isSubmitted'));
          },

          // Reset the model to let the user have another go (not the same as attempts)
          reset: function(type, force) {
              if (!this.get("_canReset") && !force) return;

              type = type || true; //hard reset by default, can be "soft", "hard"/true

              ItemsComponentModel.prototype.reset.call(this, type, force);

              this.set({
                  _isCorrect: undefined,
                  _isSubmitted: false
              });
          },

		refresh: function() {
              this.trigger('question:refresh');
          },

		/**
		 * used by adapt-contrib-spoor to get the user's answers in the format required by the cmi.interactions.n.student_response data field
		 * returns the user's answers as a string in the format '1,5,2'
		 */
		getResponse: function () {
			var activeItems = this.getActiveItems();
			var activeIndexes = activeItems.map(function (itemModel) {
				// indexes are 0-based, we need them to be 1-based for cmi.interactions
				return itemModel.get('_index') + 1;
			});
			return activeIndexes.join(',');
		},

		/**
		 * used by adapt-contrib-spoor to get the type of this question in the format required by the cmi.interactions.n.type data field
		 */
		getResponseType: function () {
			return 'numeric';
		}

	});

	return MediaExplorerItemsModel;
});
