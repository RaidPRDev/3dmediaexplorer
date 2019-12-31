define([
    'core/js/adapt',
    './mediaExplorerView',
    './mediaExplorerModel',
    // 'core/js/models/itemsComponentModel'
], function(Adapt, MediaExplorerView, MediaExplorerItemsModel) {

    return Adapt.register('mediaexplorer3D', {
        model: MediaExplorerItemsModel.extend({}),
        view: MediaExplorerView
    });

});
