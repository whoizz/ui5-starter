sap.ui.define([
	"jquery.sap.global",
	"sap/ui/core/Control",
	"sap/ui/base/ManagedObject"
], function (jQuery, Control, ManagedObject) {
	"use strict";

	var STYLE_WRAPPER = {
		overflow: 'auto',
		willChange: 'transform',
		WebkitOverflowScrolling: 'touch',
		position: 'relative',
	};

	var STYLE_INNER = {
		position: 'relative',
		overflow: 'hidden',
		width: '100%',
		minHeight: '100%',
	};

	var STYLE_ITEM = {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
	};

	function SizeAndPositionManager(iItemCount, iItemSizeGetter, iEstimatedItemSize) {
		this.itemCount = iItemCount;
		this.itemSizeGetter = iItemSizeGetter;
		this.estimatedItemSize = iEstimatedItemSize;
		this.lastMeasuredIndex = -1;
		this.itemSizeAndPositionData = {};
		this.updateConfig = function(iItemCount, iEstimatedItemSize) {
			this.itemCount = iItemCount;
			this.estimatedItemSize = iEstimatedItemSize;
		};
		this.getLastMeasuredIndex = function() {
			return this.lastMeasuredIndex;
		};
		this.destroy = function() {
			for (var sKey in this.itemSizeAndPositionData) {
				delete this.itemSizeAndPositionData[sKey];
			}
		};
		this.getSizeAndPositionForIndex = function(iIndex) {
			if (this.itemCount === 0) {
				return 0;
			}
			if (iIndex < 0 || iIndex >= this.itemCount) {
				throw Error("Requested index " + iIndex + " is outside of range 0.." + this.itemCount);
			}
			if (iIndex > this.lastMeasuredIndex) {
				var lastMeasuredSizeAndPosition = this.getSizeAndPositionOfLastMeasuredItem();
				var offset = lastMeasuredSizeAndPosition.offset + lastMeasuredSizeAndPosition.size;
				for (var i = this.lastMeasuredIndex + 1; i <= iIndex; i++) {
					var size = this.itemSizeGetter(i);
					if (size == null || isNaN(size)) {
						throw Error("Invalid size returned for index " + i + " of value " + size);
					}
					this.itemSizeAndPositionData[i] = { offset: offset, size: size };
					offset += size;
				}
				this.lastMeasuredIndex = iIndex;
			}
			return this.itemSizeAndPositionData[iIndex];
		};
		this.getSizeAndPositionOfLastMeasuredItem = function() {
			return this.lastMeasuredIndex >= 0 ? this.itemSizeAndPositionData[this.lastMeasuredIndex] : { offset: 0, size: 0 };
		};
		this.getTotalSize = function() {
			var lastMeasuredSizeAndPosition = this.getSizeAndPositionOfLastMeasuredItem();
			return lastMeasuredSizeAndPosition.offset + lastMeasuredSizeAndPosition.size + (this.itemCount - this.lastMeasuredIndex - 1) * this.estimatedItemSize;
		};
		this.getUpdatedOffsetForIndex = function(align, containerSize, currentOffset, targetIndex) {
			if (containerSize <= 0) {
				return 0;
			}		
			var datum = this.getSizeAndPositionForIndex(targetIndex);
			var maxOffset = datum.offset;
			var minOffset = maxOffset - containerSize + datum.size;
			var idealOffset;
			switch (align) {
				case "end":
					idealOffset = minOffset;
					break;
				case "center":
					idealOffset = maxOffset - (containerSize - datum.size) / 2;
					break;
				case "start":
					idealOffset = maxOffset;
					break;
				default:
					idealOffset = Math.max(minOffset, Math.min(maxOffset, currentOffset));
			}
			var totalSize = this.getTotalSize();
			return Math.max(0, Math.min(totalSize - containerSize, idealOffset));
		};
		this.getVisibleRange = function(containerSize, offset, overscanCount) {
			var totalSize = this.getTotalSize();
			if (totalSize === 0) {
				return {};
			}
			var maxOffset = offset + containerSize;
			var start = this.findNearestItem(offset);
			if (typeof start === 'undefined') {
				throw Error("Invalid offset " + offset + " specified");
			}
			var datum = this.getSizeAndPositionForIndex(start);
			offset = datum.offset + datum.size;
			var stop = start;
			while (offset < maxOffset && stop < this.itemCount - 1) {
				stop++;
				offset += this.getSizeAndPositionForIndex(stop).size;
			}
			if (overscanCount) {
				start = Math.max(0, start - overscanCount);
				stop = Math.min(stop + overscanCount, this.itemCount - 1);
			}
			return {
				start: start,
				stop: stop,
			};
		};
		this.resetItem = function(index) {
			this.lastMeasuredIndex = Math.min(this.lastMeasuredIndex, index - 1);
		};
		this.findNearestItem = function(offset) {
			if (isNaN(offset)) {
				throw Error("Invalid offset " + offset + " specified");
			}
			offset = Math.max(0, offset);
			var lastMeasuredSizeAndPosition = this.getSizeAndPositionOfLastMeasuredItem();
			var lastMeasuredIndex = Math.max(0, this.lastMeasuredIndex);
			return (lastMeasuredSizeAndPosition.offset >= offset ? this.binarySearch(0, lastMeasuredIndex, offset) : this.exponentialSearch(lastMeasuredIndex, offset));
		};
		this.binarySearch = function(low, high, offset) {
			var middle = 0;
			var currentOffset = 0;
			while (low <= high) {
				middle = low + Math.floor((high - low) / 2);
				currentOffset = this.getSizeAndPositionForIndex(middle).offset;
				if (currentOffset === offset) {
					return middle;
				} else if (currentOffset < offset) {
					low = middle + 1;
				} else if (currentOffset > offset) {
					high = middle - 1;
				}
			}
			if (low > 0) {
				return low - 1;
			}
			return 0;
		};
		this.exponentialSearch = function(index, offset) {
			var interval = 1;
			while (index < this.itemCount && this.getSizeAndPositionForIndex(index).offset < offset) {
				index += interval;
				interval *= 2;
			}
			return this.binarySearch({high: Math.min(index, this.itemCount - 1), low: Math.floor(index / 2), offset: offset});
		};
	}

	var InfiniteList = Control.extend("whoizz.ui5.starter.controls.InfiniteList", {
		
		ALIGN_AUTO: "auto",
		ALIGN_START: "start",
		ALIGN_CENTER: "center",
		ALIGN_END: "end",
		DIRECTION: {
			DIRECTION_VERTICAL: "vertical",
			DIRECTION_HORIZONTAL: "horizontal"
		},
		SCROLL_CHANGE_REASON: {
			SCROLL_CHANGE_OBSERVED: "observed",
			SCROLL_CHANGE_REQUESTED: "requested"
		},
		scrollProp: {
			vertical: "scrollTop",
			horizontal: "scrollLeft"
		},
		sizeProp: {
			vertical: "height",
			horizontal: "width"
		},
		positionProp: {
			vertical: "top",
			horizontal: "left"
		},

		styleCache: {},
		sizeAndPositionManager: null,
		overscanCount: 4,
		
		_width: "100%",
		_height: "100%",

		wrapStyle: null,
		innerStyle: null,
		offset: null,
		oldOffset: null,
		scrollChangeReason: null,
		handleScrollbind: null,

		_lastEvent: null,
		_renderedItems: [],
		_iContainerSize: null,

		metadata: {
			properties: {
				classes: {
					type: "string", defaultValue: null
				},
				styles: {
					type: "object", defaultValue: null
				},
				screenItems: {
					type: "int", defaultValue: 0
				},				
				scrollDirection: {
					type: "string", defaultValue: "vertical"
				},
				scrollOffset: {
					type: "float", defaultValue: null
				},
				scrollToIndex: {
					type: "float", defaultValue: 'undefined'
				},
				scrollToAlignment: {
					type: "string", defaultValue: "auto"
				},
				estimatedItemSize: {
					type: "float", defaultValue: 'undefined'
				},
				itemSize: {
					type: "float", defaultValue: 'undefined'
				},
				width: {
					type: "string", defaultValue: "100%"					
				},
				height: {
					type: "string", defaultValue: "100%"					
				},
				unit: {
					type: "string", defaultValue: "px"					
				},
			},
			aggregations: {
				items: {
					type: "sap.ui.core.Control", multiple: true, singularName: "item", bindable: "bindable"
				}
			},
			events: {
				listRendered: {
					parameters: {
						"start": {type: "int"},
						"stop": {type: "int"},
						"data": {type: "array"},
						"offset": {type: "int"},
						"items": {type: "array"},
						"getStyle": {type: "function"}
					}
				}
			},
		}

	});

	InfiniteList.prototype.itemCount = function() {
		var aItems = this.getItems();
		return aItems ? aItems.length : 0;
	};

	InfiniteList.prototype.currentSizeProp = function () {
		var sScrollDirection = this.getScrollDirection();
		return this.sizeProp[sScrollDirection];
	};

	InfiniteList.prototype.currentScrollProp = function() {
		var sScrollDirection = this.getScrollDirection();
		return this.scrollProp[sScrollDirection];
	};

	InfiniteList.prototype.handleScroll = function(oEvent) {
		var iOffset = this._getNodeOffset();
		if (iOffset < 0 || this.offset === iOffset || oEvent.target !== this.getDomRef()) {
			return;
		}
		this.offset = iOffset;
		this.scrollChangeReason = this.SCROLL_CHANGE_REASON.SCROLL_CHANGE_OBSERVED;
		this.renderChunk();
	};

	InfiniteList.prototype.getStyle = function(iIndex) {
		var oStyle = this.styleCache[iIndex];
		if (oStyle) {
			return oStyle;
		}
		var oSizeAndPosition = this.sizeAndPositionManager.getSizeAndPositionForIndex(iIndex);
		oStyle = Object.assign({}, STYLE_ITEM);
		oStyle[this.currentSizeProp()] = this._addUnit(oSizeAndPosition.size);
		oStyle[this.positionProp[this.getScrollDirection()]] = this._addUnit(oSizeAndPosition.offset);
		this.styleCache[iIndex] = oStyle;
		return this.styleCache[iIndex];
	};

	InfiniteList.prototype.renderChunk = function() {
		var oDomRef = this.getDomRef();
		var iContainerSize = (typeof this.getProperty(this.currentSizeProp()) === 'number' ?  this.getProperty(this.currentSizeProp()) : 0);
		if (iContainerSize === 0) {
			switch (this.getProperty("scrollDirection")) {
				case this.DIRECTION.DIRECTION_HORIZONTAL:
					iContainerSize = oDomRef.clientWidth;
					break;
				case this.DIRECTION.DIRECTION_VERTICAL:
					iContainerSize = oDomRef.clientHeight;
					break;
			}
		}
		var oVisibleRange = this.sizeAndPositionManager.getVisibleRange(iContainerSize, this.offset, this.overscanCount);
		if (typeof oVisibleRange.start !== 'undefined' && typeof oVisibleRange.stop !== 'undefined') {
			var aItems = [];
			var aControls = this.getItems();
			var oControl, oElement, aElements, aInvalidNodes, aNewNodes;
			var oInnerNode = oDomRef ? jQuery(oDomRef).find(".mInnerStyle")[0] : null;
			var iItemsInView = parseInt(iContainerSize / this.getEstimatedItemSize());
			if (oDomRef && oInnerNode) {
				aElements = this._newArray(oVisibleRange.stop - iItemsInView - (this.overscanCount * 2) > -1 ? oVisibleRange.stop - iItemsInView - (this.overscanCount * 2) : 0, oVisibleRange.stop);
				aInvalidNodes = this._arrayDifferences(this._renderedItems, aElements);
				aInvalidNodes.forEach(function(iIndex) {
					jQuery(oInnerNode).find("div[id='" + this.getId() + "-item_" + iIndex + "']").remove();
				}.bind(this));
				aNewNodes = this._arrayDifferences(aElements, this._renderedItems);
				aNewNodes.forEach(function(iIndex) {
					oControl = aControls[iIndex];
					oElement = document.createElement("div");
					oElement.setAttribute("id", this.getId() + "-item_" + iIndex);
					Object.assign(oElement.style, this.getStyle(iIndex));
					this._oRm.render(oControl, oElement);
					oInnerNode.appendChild(oElement);		
					aItems.push(oControl);
				}.bind(this));
				this._renderedItems = aElements;
			}
			this._updateStyles();
			if (!this._isPureNumber(this.itemSize)) {
				this.innerStyle = Object.assign({}, STYLE_INNER);
				this.innerStyle[this.currentSizeProp] = this._addUnit(this.sizeAndPositionManager.getTotalSize());
			}
			this._lastEvent = {
				"start": oVisibleRange.start,
				"stop": oVisibleRange.stop,
				"offset": this.offset,
				"items": aItems,
				"getStyle": this.getStyle.bind(this),
			};
			this.fireListRendered(this._lastEvent);
		}
		this._listDidUpdate();
	};

	InfiniteList.prototype._listDidUpdate = function() {
		if (this.oldOffset !== this.offset && this.scrollChangeReason === this.SCROLL_CHANGE_REASON.SCROLL_CHANGE_REQUESTED) {
			this.scrollTo(this.offset);
		}
	};

	InfiniteList.prototype._updateStyles = function() {
		var oDomRef = this.getDomRef();
		if (oDomRef) {
			this.wrapStyle = Object.assign({}, STYLE_WRAPPER);
			this.wrapStyle["height"] = this._addUnit(this.getHeight());
			this.wrapStyle["width"] = this._addUnit(this.getWidth());
			Object.assign(oDomRef.style, this.wrapStyle);
			this.innerStyle = Object.assign({}, STYLE_INNER);
			this.innerStyle[this.currentSizeProp()] = this._addUnit(this.sizeAndPositionManager.getTotalSize());
			Object.assign(jQuery(oDomRef).find(".mInnerStyle")[0].style, this.innerStyle);
		}
	};

	InfiniteList.prototype.init = function () {
		jQuery.sap.log.debug("init()");
		this._oRm = sap.ui.getCore().createRenderManager();
		this._createSizeAndPositionManager();
		this._performScroll();
	};

	InfiniteList.prototype.onBeforeRendering = function() {
		jQuery.sap.log.debug("onBeforeRendering()");
		this.recomputeSizes();
		this.sizeAndPositionManager.updateConfig(this.itemCount(), this.getEstimatedItemSize());
		var iScrollToIndex = this.getProperty("scrollToIndex");
		if (typeof iScrollToIndex === 'number') {
			this.offset = this.getOffsetForIndex(iScrollToIndex, this.getProperty("scrollToAlignment"), this.itemCount());
			this.scrollChangeReason = this.SCROLL_CHANGE_REASON.SCROLL_CHANGE_REQUESTED;
		}
	};

	InfiniteList.prototype.onAfterRendering = function() {
		jQuery.sap.log.debug("onAfterRendering()");
		var oDomRef = this.getDomRef();
		if (oDomRef) {
			oDomRef.addEventListener("scroll", this.handleScroll.bind(this), {passive: true});
		}
	};

	InfiniteList.prototype.destroy = function() {
		jQuery.sap.log.debug("destroy()");
		this._oRm.destroy();
		this._oRm = null;		
		this.sizeAndPositionManager.destroy();
		var oDomRef = this.getDomRef();
		if (oDomRef) {
			oDomRef.removeEventListener("scroll", this.handleScroll.bind(this));
		}
	};

	InfiniteList.prototype.exit = function() {
		jQuery.sap.log.debug("exit()");
	};

	InfiniteList.prototype.setScrollToIndex = function(iScrollToIndex) {
		this.setProperty("scrollToIndex", iScrollToIndex, false);
		var iScrollToIndex = this.getProperty("scrollToIndex");
		if (typeof iScrollToIndex === 'number') {
			this.offset = this.getOffsetForIndex(iScrollToIndex, this.getProperty("scrollToAlignment"), this.itemCount());
			this.scrollChangeReason = this.SCROLL_CHANGE_REASON.SCROLL_CHANGE_REQUESTED;
		}
	};

	InfiniteList.prototype.setScrollToAligment = function(sScrollToAligment) {
		this.setProperty("scrollToAlignment", sScrollToAligment, false);
		var iScrollToIndex = this.getProperty("scrollToIndex");
		if (typeof iScrollToIndex === 'number') {
			this.offset = this.getOffsetForIndex(iScrollToIndex, this.getProperty("scrollToAlignment"), this.itemCount());
			this.scrollChangeReason = this.SCROLL_CHANGE_REASON.SCROLL_CHANGE_REQUESTED;
		}
	};

	InfiniteList.prototype.setItemSize = function(iItemSize) {
		this.setProperty("itemSize", iItemSize, false);
		this.recomputeSizes();
		var iScrollToIndex = this.getProperty("scrollToIndex");
		if (typeof iScrollToIndex === 'number') {
			this.offset = this.getOffsetForIndex(iScrollToIndex, this.getProperty("scrollToAlignment"), this.itemCount());
			this.scrollChangeReason = this.SCROLL_CHANGE_REASON.SCROLL_CHANGE_REQUESTED;
		}		
	};

	InfiniteList.prototype.setEstimatedItemSize = function(iEstimatedItemSize) {
		this.setProperty("estimatedItemSize", iEstimatedItemSize, false);
		this.recomputeSizes();
		this.sizeAndPositionManager.updateConfig(this.itemCount(), this.getEstimatedItemSize());
		var iScrollToIndex = this.getProperty("scrollToIndex");
		if (typeof iScrollToIndex === 'number') {
			this.offset = this.getOffsetForIndex(iScrollToIndex, this.getProperty("scrollToAlignment"), this.itemCount());
			this.scrollChangeReason = this.SCROLL_CHANGE_REASON.SCROLL_CHANGE_REQUESTED;
		}
	};

	InfiniteList.prototype.setScrollOffset = function(iScrollOffset) {
		this.setProperty("scrollOffset", iScrollOffset, false);
		this.offset = iScrollOffset || 0;
		this.scrollChangeReason = this.SCROLL_CHANGE_REASON.SCROLL_CHANGE_REQUESTED;
	};

	InfiniteList.prototype.getEstimatedItemSize = function() {
		var iEstimatedItemSize = this.getProperty("estimatedItemSize");
		if (typeof iEstimatedItemSize === 'number') {
			return iEstimatedItemSize
		}
		var iItemSize = this.getProperty("itemSize");
		return typeof iItemSize === 'number' && iItemSize || 50;
	};


	InfiniteList.prototype._createSizeAndPositionManager = function() {
		if (!this.sizeAndPositionManager) {
			this.sizeAndPositionManager = new SizeAndPositionManager(this.itemCount(), this.getSize.bind(this), this.getEstimatedItemSize());
		}
		return this.sizeAndPositionManager;
	};

	InfiniteList.prototype._addUnit = function(sValue) {  	
		return (typeof sValue === 'string' ? sValue : sValue + this.getProperty("unit"));
	};

	InfiniteList.prototype._getNodeOffset = function() {
		var oDomRef = this.getDomRef();
		if (oDomRef) {
			var sCurrentScrollProp = this.currentScrollProp();
			return oDomRef[sCurrentScrollProp];
		}
		return -1;
	};

	InfiniteList.prototype._performScroll = function() {
		var iScrollOffset = this.getScrollOffset();
		var iScrollToIndex = this.getScrollToIndex();
		this.offset = iScrollOffset || iScrollOffset != null && this.getOffsetForIndex(iScrollToIndex) || 0;
		this.scrollChangeReason = this.SCROLL_CHANGE_REASON.SCROLL_CHANGE_REQUESTED;
		if (iScrollOffset != null) {
			this.scrollTo(iScrollOffset);
		} else if (this.scrollToIndex != null) {
			this.scrollTo(this.getOffsetForIndex(iScrollToIndex));
		}
	};

	InfiniteList.prototype.scrollTo = function(sValue) {
		var oDomRef = this.getDomRef();
		if (oDomRef) {
			var sCurrentScrollProp = this.currentScrollProp();
			oDomRef[sCurrentScrollProp] = sValue;
			this.oldOffset = sValue;
		}
	};

	InfiniteList.prototype.getOffsetForIndex = function(iIndex, sScrollToAligment, iItemCount) {
		sScrollToAligment = sScrollToAligment || this.getProperty("scrollToAlignment");
		iItemCount = iItemCount || this.itemCount();
		if (iIndex < 0 || iIndex >= iItemCount) {
			iIndex = 0;
		}
		var iOffset = this.offset || 0;
		return this.sizeAndPositionManager.getUpdatedOffsetForIndex(this.getProperty("scrollToAlignment"), this.getProperty(this.currentSizeProp()), iOffset, iIndex);
	};

	InfiniteList.prototype.getSize = function(iIndex) {
		if (typeof this.itemSize === 'function') {
			return this.itemSize(iIndex);
		}
		return this._isArray(this.itemSize) ? this.itemSize[iIndex] : this.getProperty("itemSize");
	};

	InfiniteList.prototype.recomputeSizes = function(startIndex) {
		startIndex = startIndex || 0;
		this.styleCache = {};
		this.sizeAndPositionManager.resetItem(startIndex);
	};

	InfiniteList.prototype._isArray = function(oValue) {
		return Object.prototype.toString.call(oValue) === '[object Array]';
	};

	InfiniteList.prototype._isPureNumber = function(oValue) {
		if (typeof oValue === 'number' || !oValue) {
			return true;
		} else {
			return false;
		}
	};

	InfiniteList.prototype._arrayDifferences = function(a1, a2) {
		return a1.filter(function (i) {
			return a2.indexOf(i) === -1;
		});
	};

	InfiniteList.prototype._newArray = function(start, end) {
		var _newArray = [];
		for (var i = start; i <= end; i++) {
			_newArray.push(i);
		}
		return _newArray;
	};

	return InfiniteList;

});
