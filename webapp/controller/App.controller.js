sap.ui.define([
  'sap/ui/core/mvc/Controller',
  'sap/m/MessageToast',
], function(Controller, MessageToast) {
  'use strict';
  
	return Controller.extend('whoizz.ui5.starter.controller.App', {

		onInit() {
   		var oModel = new sap.ui.model.json.JSONModel();
   		oModel.setSizeLimit(1000000);
			oModel.loadData("data/Sample.json");
			this.getView().setModel(oModel, "sampleData");
		},

		onButtonPress(oEvent) {
			MessageToast.show(oEvent.getSource().getBindingContext("sampleData").getProperty("company"));
		}

	});
});
