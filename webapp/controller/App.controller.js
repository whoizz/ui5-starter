sap.ui.define([
  'sap/ui/core/mvc/Controller',
  'sap/m/MessageToast',
], function(Controller, MessageToast) {
  'use strict';
  
	return Controller.extend('whoizz.ui5.starter.controller.App', {

		onInit() {
   		var oModel = new sap.ui.model.json.JSONModel();
   		// oModel.setSizeLimit(1000000);
			oModel.loadData("data/Sample.json");
			this.getView().setModel(oModel, "sampleData");
		},

		onAfterRendering() {
			var oInfiniteList = this.getView().byId("mInfinite");
			// oInfiniteList.setItemSize(this.getItemSize.bind(this));
		},

		onButtonPress(oEvent) {
			MessageToast.show(oEvent.getSource().getBindingContext("sampleData").getProperty("company"));
		},

		getItemSize(iIndex) {
			return 48 + parseInt(iIndex);
		},

		onListRendered(oEvent) {
			debugger
		}

	});
});
