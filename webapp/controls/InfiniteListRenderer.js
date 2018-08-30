sap.ui.define([
	"jquery.sap.global"
	],
	function(jQuery) {
	"use strict";

	var InfiniteListRenderer = {};

	InfiniteListRenderer.render = function(oRm, oControl) {
		oRm.write("<div");
		oRm.writeControlData(oControl);
		oRm.addClass("mWrapStyle");
		oRm.writeClasses();
		var sWidth = oControl.getWidth();
		if (sWidth) {
			oRm.addStyle("width", sWidth);
		}
		var sHeight = oControl.getHeight();
		if (sHeight) {
			oRm.addStyle("height", sHeight);
		}		
		oRm.writeStyles();
		oRm.write(">");
		oRm.write("<div class=\"mInnerStyle\">");
		jQuery.sap.delayedCall(0, this, function() {
			oControl.renderChunk();			
		});
		oRm.write("</div>");
		oRm.write("</div>");
	};

	return InfiniteListRenderer;

}, /* bExport= */ true);