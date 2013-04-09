/*
 * Paper.js - The Swiss Army Knife of Vector Graphics Scripting.
 * http://paperjs.org/
 *
 * Copyright (c) 2011 - 2013, Juerg Lehni & Jonathan Puckey
 * http://lehni.org/ & http://jonathanpuckey.com/
 *
 * Distributed under the MIT license. See LICENSE file for details.
 *
 * All rights reserved.
 */

/**
 * @name Color
 *
 * @class All properties and functions that expect color values accept
 * instances of the different color classes such as {@link RgbColor},
 * {@link HsbColor} and {@link GrayColor}, and also accept named colors
 * and hex values as strings which are then converted to instances of
 * {@link RgbColor} internally.
 *
 * @classexample {@paperscript}
 * // Named color values:
 *
 * // Create a circle shaped path at {x: 80, y: 50}
 * // with a radius of 30.
 * var circle = new Path.Circle(new Point(80, 50), 30);
 *
 * // Pass a color name to the fillColor property, which is internally
 * // converted to a Color.
 * circle.fillColor = 'green';
 *
 * @classexample {@paperscript}
 * // Hex color values:
 *
 * // Create a circle shaped path at {x: 80, y: 50}
 * // with a radius of 30.
 * var circle = new Path.Circle(new Point(80, 50), 30);
 *
 * // Pass a hex string to the fillColor property, which is internally
 * // converted to a Color.
 * circle.fillColor = '#ff0000';
 */
var Color = this.Color = Base.extend(new function() {

	var types = {
		gray: ['gray'],
		rgb: ['red', 'green', 'blue'],
		hsb: ['hue', 'saturation', 'brightness'],
		hsl: ['hue', 'saturation', 'lightness'],
		gradient: ['gradient', 'origin', 'destination', 'hilite']
	};

	var colorCache = {},
		colorCtx;

	function nameToRgb(name) {
		var cached = colorCache[name];
		if (!cached) {
			// Use a canvas to draw to with the given name and then retrieve rgb
			// values from. Build a cache for all the used colors.
			if (!colorCtx) {
				colorCtx = CanvasProvider.getContext(1, 1);
				colorCtx.globalCompositeOperation = 'copy';
			}
			// Set the current fillStyle to transparent, so that it will be
			// transparent instead of the previously set color in case the new
			// color can not be interpreted.
			colorCtx.fillStyle = 'rgba(0,0,0,0)';
			// Set the fillStyle of the context to the passed name and fill the
			// canvas with it, then retrieve the data for the drawn pixel:
			colorCtx.fillStyle = name;
			colorCtx.fillRect(0, 0, 1, 1);
			var data = colorCtx.getImageData(0, 0, 1, 1).data;
			cached = colorCache[name] = [
				data[0] / 255,
				data[1] / 255,
				data[2] / 255
			];
		}
		return cached.slice();
	}

	function hexToRgb(string) {
		var hex = string.match(/^#?(\w{1,2})(\w{1,2})(\w{1,2})$/);
		if (hex.length >= 4) {
			var components = [0, 0, 0];
			for (var i = 0; i < 3; i++) {
				var value = hex[i + 1];
				components[i] = parseInt(value.length == 1
						? value + value : value, 16) / 255;
			}
			return components;
		}
	}

	// For hsb-rgb conversion, used to lookup the right parameters in the
	// values array.
	var hsbIndices = [
		[0, 3, 1], // 0
		[2, 0, 1], // 1
		[1, 0, 3], // 2
		[1, 2, 0], // 3
		[3, 1, 0], // 4
		[0, 1, 2]  // 5
	];

	// Calling convention for converters:
	// The components are passed as an arguments list, and returned as an array.
	// alpha is left out, because the conversion does not change it.
	var converters = {
		'rgb-hsb': function(r, g, b) {
			var max = Math.max(r, g, b),
				min = Math.min(r, g, b),
				delta = max - min,
				h = delta === 0 ? 0
					:   ( max == r ? (g - b) / delta + (g < b ? 6 : 0)
						: max == g ? (b - r) / delta + 2
						:            (r - g) / delta + 4) * 60; // max == b
			return [h, max === 0 ? 0 : delta / max, max];
		},

		'hsb-rgb': function(h, s, b) {
			var h = (h / 60) % 6, // Scale to 0..6
				i = Math.floor(h), // 0..5
				f = h - i,
				i = hsbIndices[i],
				v = [
					b,						// b, index 0
					b * (1 - s),			// p, index 1
					b * (1 - s * f),		// q, index 2
					b * (1 - s * (1 - f))	// t, index 3
				];
			return [v[i[0]], v[i[1]], v[i[2]]];
		},

		// HSL code is based on:
		// http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
		'rgb-hsl': function(r, g, b) {
			var max = Math.max(r, g, b),
				min = Math.min(r, g, b),
				delta = max - min,
				achromatic = delta === 0,
				h = achromatic ? 0
					:   ( max == r ? (g - b) / delta + (g < b ? 6 : 0)
						: max == g ? (b - r) / delta + 2
						:            (r - g) / delta + 4) * 60, // max == b
				l = (max + min) / 2,
				s = achromatic ? 0 : l < 0.5
						? delta / (max + min)
						: delta / (2 - max - min);
			return [h, s, l];
		},

		'hsl-rgb': function(h, s, l) {
			h /= 360;
			if (s === 0)
				return [l, l, l];
			var t3s = [ h + 1 / 3, h, h - 1 / 3 ],
				t2 = l < 0.5 ? l * (1 + s) : l + s - l * s,
				t1 = 2 * l - t2,
				c = [];
			for (var i = 0; i < 3; i++) {
				var t3 = t3s[i];
				if (t3 < 0) t3 += 1;
				if (t3 > 1) t3 -= 1;
				c[i] = 6 * t3 < 1
					? t1 + (t2 - t1) * 6 * t3
					: 2 * t3 < 1
						? t2
						: 3 * t3 < 2
							? t1 + (t2 - t1) * ((2 / 3) - t3) * 6
							: t1;
			}
			return c;
		},

		'rgb-gray': function(r, g, b) {
			// Using the standard NTSC conversion formula that is used for
			// calculating the effective luminance of an RGB color:
			// http://www.mathworks.com/support/solutions/en/data/1-1ASCU/index.html?solution=1-1ASCU
			return [r * 0.2989 + g * 0.587 + b * 0.114];
		},

		'gray-rgb': function(g) {
			return [g, g, g];
		},

		'gray-hsb': function(g) {
			return [0, 0, g];
		},

		'gray-hsl': function(g) {
			// TODO: Is lightness really the same as brightness for gray?
			return [0, 0, g];
		},

		'gradient-rgb': function(gradient) {
			// TODO: Implement
			return [];
		},

		'rgb-gradient': function(r, g, b) {
			// TODO: Implement
			return [];
		}

	};

	// Produce getters and setter methods for the various color components known
	// by the different color types. Requesting any of these components on any
	// color internally converts the color to the required type and then returns
	// its component.
	return Base.each(types, function(properties, type) {
		Base.each(properties, function(name, index) {
			var part = Base.capitalize(name),
				isHue = name === 'hue',
				isGradient = name === 'gradient',
				isPoint = type === 'gradient' && !isGradient,
				isHilite = name === 'hilite',
				// Both hue and saturation have overlapping properties between
				// hsb and hsl. Handle this here separately, by testing for
				// overlaps and skipping conversion if the type is /hs[bl]/
				hasOverlap = /^(hue|saturation)$/.test(name);

			this['get' + part] = function() {
				return this._type === type
					|| hasOverlap && /^hs[bl]$/.test(this._type)
						? this._components[index]
						: this._convert(type)[index];
			};

			this['set' + part] = function(value) {
				// Convert to the requrested type before setting the value
				if (this._type !== type
						&& !(hasOverlap && /^hs[bl]$/.test(this._type))) {
					this._components = this._convert(type);
					this._type = type;
				}
				if (!isGradient)
					value = isHue
						// Keep negative values within modulo 360 too:
						? ((value % 360) + 360) % 360
						: isPoint
							? Point.read(arguments, 0, 0, true, isHilite) // clone, readNull
							// All other values are 0..1
							: Math.min(Math.max(value, 0), 1);
				if (value != null) {
					this._components[index] = value;
					if (isGradient)
						value._addOwner(this);
					this._changed();
				}
			};
		}, this);
	}, /** @lends Color# */{
		_class: 'Color',
		// Tell Base.read that we do not want null to be converted to a color.
		_readNull: true,
		// Tell Base.read that the Point constructor supporst reading with index
		_readIndex: true,

		initialize: function(arg) {
			// We are storing color internally as an array of components
			var slice = Array.prototype.slice,
				args = arguments,
				read = 0,
				type;
			if (Array.isArray(arg)) {
				args = arg;
				arg = args[0];
			}
			// Try type arg first
			if (typeof arg === 'string' && arg in types) {
				type = arg;
				if (this._read)
					read = 1; // will be increased below
				// Shift type out of the arguments list, and process normally.
				args = slice.call(args, 1);
				arg = args[0];
			}
			var argType = arg != null && typeof arg,
				components = argType === 'number'
					? args
					// Do not use Array.isArray() to also support arguments list
					: argType === 'object' && arg.length != null
						? arg
						: null,
				alpha;
			if (components) {
				if (!type)
					// type = components.length >= 4
					// 		? 'cmyk'
					// 		: components.length >= 3
					type = components.length >= 3
							? 'rgb'
							: 'gray';
				var length = types[type].length;
				alpha = components[length];
				if (this._read)
					read += components === arguments
						? length + (alpha != null ? 1 : 0)
						: 1;
				components = slice.call(components, 0, length);
			} else {
				if (argType === 'string') {
					components = arg.match(/^#[0-9a-f]{3,6}$/i)
							? hexToRgb(arg)
							: nameToRgb(arg);
					type = 'rgb';
				} else if (argType === 'object') {
					if (arg._class === 'Color') {
						type = arg._type;
						components = arg._components.slice();
						alpha = arg._alpha;
					} else if (arg._class === 'Gradient') {
						type = 'gradient';
						components = slice.call(args);
					} else {
						// Determine type by presence of object property names
						type = 'hue' in arg
							? 'lightness' in arg
								? 'hsl'
								: 'hsb'
							: 'gradient' in arg
								? 'gradient'
								: 'gray' in arg
									? 'gray'
									: 'rgb';
						var properties = types[type];
						components = [];
						for (var i = 0, l = properties.length; i < l; i++)
							components[i] = arg[properties[i]] || 0;
						alpha = arg.alpha;
					}
				}
				if (this._read && type)
					read = 1;
			}
			// Define this gradient Color's unique id.
			if (type === 'gradient')
				this._id = ++Base._uid;
			// Default fallbacks: rgb, black
			this._type = type || 'rgb';
			this._components = components || (type === 'gray' ? [0] : [0, 0, 0]);
			this._alpha = alpha;
			// Trigger setters for each component by looping through properties
			// and resseting component value. 
			// TODO: This is a hack and should implemented better, e.g. with
			// value handlers.
			var properties = types[this._type];
			for (var i = 0, l = properties.length; i < l; i++)
				this[properties[i]] = this._components[i];
			if (this._read)
				this._read = read;
		},

		_serialize: function(options, dictionary) {
			return Base.serialize(
					// We can ommit the type for gray and rgb:
					/^(gray|rgb)$/.test(this._type)
						? this._components
						: [this._type].concat(this._components),
					options, true, dictionary);
		},

		/**
		 * Called by various setters whenever a color value changes
		 */
		_changed: function() {
			this._css = null;
			this._canvasGradient = null;
			if (this._owner)
				this._owner._changed(/*#=*/ Change.STYLE);
		},

		/**
		 * @return {Color} a copy of the color object
		 */
		clone: function() {
			return Color.create(this._type, this._components.slice(),
					this._alpha);
		},

		/**
		 * @return {Number[]} the converted components as an array.
		 */
		_convert: function(type) {
			var converter;
			return this._type == type
					? this._components.slice()
					: (converter = converters[this._type + '-' + type])
						? converter.apply(this, this._components)
						// Convert to and from rgb if no direct converter exists
						: converters['rgb-' + type].apply(this,
							converters[this._type + '-rgb'].apply(this,
									this._components));
		},

		convert: function(type) {
			return Color.create(type, this._convert(type), this._alpha);
		},

		/**
		 * The type of the color as a string.
		 *
		 * @type String('rgb', 'hsb', 'gray')
		 * @bean
		 *
		 * @example
		 * var color = new Color(1, 0, 0);
		 * console.log(color.type); // 'rgb'
		 */
		getType: function() {
			return this._type;
		},

		setType: function(type) {
			this._components = this._convert(type);
			this._type = type;
		},

		getComponents: function() {
			var components = this._components.slice();
			if (this._alpha != null)
				components.push(this._alpha);
			return components;
		},

		/**
		 * The color's alpha value as a number between {@code 0} and {@code 1}.
		 * All colors of the different subclasses support alpha values.
		 *
		 * @type Number
		 * @bean
		 *
		 * @example {@paperscript}
		 * // A filled path with a half transparent stroke:
		 * var circle = new Path.Circle(new Point(80, 50), 30);
		 *
		 * // Fill the circle with red and give it a 20pt green stroke:
		 * circle.style = {
		 * 	fillColor: 'red',
		 * 	strokeColor: 'green',
		 * 	strokeWidth: 20
		 * };
		 *
		 * // Make the stroke half transparent:
		 * circle.strokeColor.alpha = 0.5;
		 */
		getAlpha: function() {
			return this._alpha != null ? this._alpha : 1;
		},

		setAlpha: function(alpha) {
			this._alpha = alpha == null ? null : Math.min(Math.max(alpha, 0), 1);
			this._changed();
		},

		/**
		 * Checks if the color has an alpha value.
		 *
		 * @return {Boolean} {@true if the color has an alpha value}
		 */
		hasAlpha: function() {
			return this._alpha != null;
		},

		/**
		 * Checks if the component color values of the color are the
		 * same as those of the supplied one.
		 *
		 * @param {Color} color the color to compare with
		 * @return {Boolean} {@true if the colors are the same}
		 */
		equals: function(color) {
			return color && this._type === color._type
					&& this._alpha === color._alpha
					&& Base.equals(this._components, color._components);
		},

		/**
		 * {@grouptitle String Representations}
		 * @return {String} A string representation of the color.
		 */
		toString: function() {
			var properties = types[this._type],
				parts = [],
				isGradient = this._type === 'gradient',
				format = Format.number;
			for (var i = 0, l = properties.length; i < l; i++) {
				var value = this._components[i];
				if (value != null)
					parts.push(properties[i] + ': '
							+ (isGradient ? value : format(value)));
			}
			if (this._alpha != null)
				parts.push('alpha: ' + format(this._alpha));
			return '{ ' + parts.join(', ') + ' }';
		},

		/**
		 * @return {String} A css string representation of the color.
		 */
		toCss: function(noAlpha) {
			var css = this._css;
			// Only cache _css value if we're not ommiting alpha, as required
			// by SVG export.
			if (!css || noAlpha) {
				var components = this._convert('rgb'),
					alpha = noAlpha || this._alpha == null ? 1 : this._alpha;
				components = [
					Math.round(components[0] * 255),
					Math.round(components[1] * 255),
					Math.round(components[2] * 255)
				];
				if (alpha < 1)
					components.push(alpha);
				var css = (components.length == 4 ? 'rgba(' : 'rgb(')
						+ components.join(', ') + ')';
				if (!noAlpha)
					this._css = css;
			}
			return css;
		},

		toCanvasStyle: function(ctx) {
			if (this._type !== 'gradient')
				return this.toCss();
			// Gradient code form here onwards, incudling caching
			if (this._canvasGradient)
				return this._canvasGradient;
			var components = this._components,
				gradient = components[0],
				stops = gradient._stops,
				origin = components[1],
				destination = components[2],
				canvasGradient;
			if (gradient._radial) {
				var radius = destination.getDistance(origin),
					hilite = components[3];
				if (hilite) {
					var vector = hilite.subtract(origin);
					if (vector.getLength() > radius)
						hilite = origin.add(vector.normalize(radius - 0.1));
				}
				var start = hilite || origin;
				canvasGradient = ctx.createRadialGradient(start.x, start.y,
						0, origin.x, origin.y, radius);
			} else {
				canvasGradient = ctx.createLinearGradient(origin.x, origin.y,
						destination.x, destination.y);
			}
			for (var i = 0, l = stops.length; i < l; i++) {
				var stop = stops[i];
				canvasGradient.addColorStop(stop._rampPoint, stop._color.toCss());
			}
			return this._canvasGradient = canvasGradient;
		},

		/**
		 * Transform the gradient color by the specified matrix.
		 *
		 * @param {Matrix} matrix the matrix to transform the gradient color by
		 */
		transform: function(matrix) {
			if (this._type === 'gradient') {
				var components = this._components;
				for (var i = 1, l = components.length; i < l; i++) {
					var point = components[i];
					matrix._transformPoint(point, point, true);
				}
			}
		},

		/**
		 * {@grouptitle RGB Components}
		 *
		 * The amount of red in the color as a value between {@code 0} and
		 * {@code 1}.
		 *
		 * @name Color#red
		 * @property
		 * @type Number
		 *
		 * @example {@paperscript}
		 * // Changing the amount of red in a color:
		 * var circle = new Path.Circle(new Point(80, 50), 30);
		 * circle.fillColor = 'blue';
		 *
		 * // Blue + red = purple:
		 * circle.fillColor.red = 1;
		 */

		/**
		 * The amount of green in the color as a value between {@code 0} and
		 * {@code 1}.
		 *
		 * @name Color#green
		 * @property
		 * @type Number
		 *
		 * @example {@paperscript}
		 * // Changing the amount of green in a color:
		 * var circle = new Path.Circle(new Point(80, 50), 30);
		 *
		 * // First we set the fill color to red:
		 * circle.fillColor = 'red';
		 *
		 * // Red + green = yellow:
		 * circle.fillColor.green = 1;
		 */

		/**
		 * The amount of blue in the color as a value between {@code 0} and
		 * {@code 1}.
		 *
		 * @name Color#blue
		 * @property
		 * @type Number
		 *
		 * @example {@paperscript}
		 * // Changing the amount of blue in a color:
		 * var circle = new Path.Circle(new Point(80, 50), 30);
		 *
		 * // First we set the fill color to red:
		 * circle.fillColor = 'red';
		 *
		 * // Red + blue = purple:
		 * circle.fillColor.blue = 1;
		 */

		/**
		 * {@grouptitle Gray Components}
		 *
		 * The amount of gray in the color as a value between {@code 0} and
		 * {@code 1}.
		 *
		 * @name Color#gray
		 * @property
		 * @type Number
		 */

		/**
		 * {@grouptitle HSB Components}
		 *
		 * The hue of the color as a value in degrees between {@code 0} and
		 * {@code 360}.
		 *
		 * @name Color#hue
		 * @property
		 * @type Number
		 *
		 * @example {@paperscript}
		 * // Changing the hue of a color:
		 * var circle = new Path.Circle(new Point(80, 50), 30);
		 * circle.fillColor = 'red';
		 * circle.fillColor.hue += 30;
		 *
		 * @example {@paperscript}
		 * // Hue cycling:
		 *
		 * // Create a rectangle shaped path, using the dimensions
		 * // of the view:
		 * var path = new Path.Rectangle(view.bounds);
		 * path.fillColor = 'red';
		 *
		 * function onFrame(event) {
		 * 	path.fillColor.hue += 0.5;
		 * }
		 */

		/**
		 * The saturation of the color as a value between {@code 0} and {@code 1}.
		 *
		 * @name Color#saturation
		 * @property
		 * @type Number
		 */

		/**
		 * The brightness of the color as a value between {@code 0} and {@code 1}.
		 *
		 * @name Color#brightness
		 * @property
		 * @type Number
		 */

		/**
		 * {@grouptitle HSL Components}
		 *
		 * The lightness of the color as a value between {@code 0} and {@code 1}.
		 *
		 * @name Color#lightness
		 * @property
		 * @type Number
		 */

		statics: /** @lends Color */{
			// Export for backward compatibility code below.
			_types: types,

			create: function(type, components, alpha) {
				var color = Base.create(Color);
				color._type = type;
				color._components = components;
				color._alpha = alpha;
				if (type === 'gradient') {
					// Make sure gradients always have an id
					color._id = ++Base._uid;
					// Clone all points:
					for (var i = 1, l = components.length; i < l; i++) {
						var point = components[i];
						if (point)
							components[i] = point.clone();
					}
				}
				return color;
			},

			random: function() {
				var random = Math.random;
				return new Color(random(), random(), random());
			}
		}
	});
});

// Expose RgbColor, RGBColor, etc. constructors for backward compatibility.
Base.each(Color._types, function(properties, type) {
	var ctor = this[Base.capitalize(type) + 'Color'] =
		function(arg) {
			var argType = arg != null && typeof arg,
				components = argType === 'object' && arg.length != null
					? arg
					: argType === 'string'
						? null
						: arguments;
			return components
					? new Color(type, components)
					: new Color(arg);
		};
	if (!/^(gray|gradient)$/.test(type))
		this[type.toUpperCase() + 'Color'] = ctor;
}, this);
