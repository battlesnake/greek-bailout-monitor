(function (window, d3, document) {
'use strict';

if (/Trident|Safari|Apple/.test(window.navigator.userAgent)) {
	window.alert('Your browser lacks full support for inline SVG, this page may not work correctly.  Recommended: Firefox/Chrome');
}

var opts = {
	container: 'main>svg',
	margin: {
		left: 100,
		right: 100,
		top: 120,
		bottom: 100
	},
	note: {
		y: 30
	},
	axisLabelDistance: {
		x: 10,
		y: 10
	},
	tickMarkLength: {
		x: 5,
		y: 5
	},
	line: true,
	points: false,
	apiTarget: 'https://raw.githubusercontent.com/battlesnake/greek-bailout-monitor/master/greek-log.tsv'
};

var elements = {
	svg: null,
	ax: null,
	ay: null,
	series: null
};

var dayNames = 'Sun Mon Tue Wed Thu Fri Sat'.split(' ');

var dataset = {
	data: null,
	range: null
};

var scaleMode = 0;

window.addEventListener('load', onLoad);

function onLoad(event) {
	elements.svg = d3.select(opts.container);
	elements.ax = elements.svg.append('g').attr('class', 'axis x-axis');
	elements.ay = elements.svg.append('g').attr('class', 'axis y-axis');
	elements.plot = elements.svg.append('g').attr('class', 'plot-area');
	elements.series = elements.plot.append('path').attr('class', 'series');
	elements.ax.append('line').attr('class', 'axis-line x-axis-line');
	elements.ay.append('line').attr('class', 'axis-line y-axis-line');
	/* Window resize event */
	window.addEventListener('resize', onResize);
	/* Scale selector */
	[].slice.apply(document.querySelectorAll('#scale input.scale-choice'))
		.map(function (el) {
			if (el.checked) {
				scaleMode = +el.getAttribute('value');
			}
			return el;
		})
		.map(function (el) {
			el.checked = +el.getAttribute('value') === scaleMode;
			return el;
		})
		.forEach(function (el) {
			el.addEventListener('change', setScaleMode);
		});
	refresh();
}

function onResize() {
	displayData(dataset);
}

function setScaleMode(event) {
	var el = this;
	if (el.checked) {
		scaleMode = +el.getAttribute('value');
	}
	dataset.range = getRange(dataset.data);
	displayData(dataset);
	return;
}

function refresh() {
	d3.text(opts.apiTarget, 'text/plain', receiveData);
}

function parseData(text) {
	return text.split('\n')
		.map(function splitRow(row) {
			return row.split('\t');
		})
		.filter(function ignoreErrors(cols) {
			return cols[1] !== 'ERROR' && !isNaN(+cols[1]);
		})
		.map(function parseCols(cols) {
			return {
				date: Date.parse(cols[0]),
				value: +cols[1]
			};
		});
}

function getRange(data) {
	var range = {
		start: data.reduce(function (acc, rec) {
			var val = rec.date;
			return (isNaN(acc) || val < acc) ? val : acc;
		}, NaN),
		end: data.reduce(function (acc, rec) {
			var val = rec.date;
			return (isNaN(acc) || val > acc) ? val : acc;
		}, NaN),
		min: data.reduce(function (acc, rec) {
			var val = rec.value;
			return (isNaN(acc) || val < acc) ? val : acc;
		}, NaN),
		max: data.reduce(function (acc, rec) {
			var val = rec.value;
			return (isNaN(acc) || val > acc) ? val : acc;
		}, NaN)
	};
	range.min = 0;
	if (scaleMode === 1) {
		range.min = 1e5;
		range.max = 1.6e9;
		range.end = range.start + 8 * 86400 * 1000;
	}
	return range;
}

function receiveData(error, text) {
	if (error) {
		console.log('Failed to receive data: ' + error);
		return;
	}
	var data = parseData(text);
	var range = getRange(data);
	dataset = {
		data: data,
		range: range
	};
	displayData();
}

function displayData() {
	var margin = opts.margin;
	var axisLabelDistance = opts.axisLabelDistance;
	var tickMarkLength = opts.tickMarkLength;
	var rc = elements.svg[0][0].getBoundingClientRect();
	var w = rc.right - rc.left;
	var h = rc.bottom - rc.top;
	var data = dataset.data;
	var range = dataset.range;
	/* Geometry generators */
	var generators = {
		ax: d3.time.scale(),
		ay: d3.scale[['linear', 'log'][scaleMode]](),
		series: d3.svg.line()
	};
	generators.ax
		.domain([range.start, range.end])
		.range([margin.left, w - margin.right]);
	generators.ay
		.domain([range.min, range.max])
		.range([h - margin.bottom, margin.top]);
	generators.series
		.x(function (d, i) { return generators.ax(d.date); })
		.y(function (d, i) { return generators.ay(d.value); });
	/* x-axis */
	elements.ax.select('line.x-axis-line')
		.transition()
		.duration(200)
		.attr('x1', generators.ax(range.start))
		.attr('x2', generators.ax(range.end))
		.attr('y1', generators.ay(range.min))
		.attr('y2', generators.ay(range.min));
	function xAxisLabelTransform(d, i) {
		return 'translate(' + generators.ax(d) + ',' + generators.ay(range.min) + ')';
	}
	var axLabel = elements.ax.selectAll('g.x-axis-label')
		.data(generators.ax.ticks(w / 100));
	axLabel.enter().append('g')
		.attr('class', 'label axis-label x-axis-label')
		.attr('transform', xAxisLabelTransform);
	axLabel.exit().remove();
	axLabel.selectAll('*').remove();
	axLabel.transition().duration(200)
		.attr('transform', xAxisLabelTransform);
	axLabel.append('line')
		.attr('x1', 0)
		.attr('x2', 0)
		.attr('y1', 0)
		.attr('y2', tickMarkLength.x);
	axLabel.append('text')
		.attr('x', -axisLabelDistance.x * 1.41)
		.attr('y', axisLabelDistance.x * 1.41)
		.text(function (d, i) {
			return dayNames[d.getDay()] + ' ' +
				dig2(d.getHours()) + ':' +
				dig2(d.getMinutes());
		});
	/* y-axis */
	elements.ay.select('line.y-axis-line')
		.transition()
		.duration(200)
		.attr('x1', generators.ax(range.start))
		.attr('x2', generators.ax(range.start))
		.attr('y1', generators.ay(range.min))
		.attr('y2', generators.ay(range.max));
	function yAxisLabelTransform(d, i) {
		return 'translate(' + generators.ax(range.start) + ',' + generators.ay(d) + ')';
	}
	var ayLabel = elements.ay.selectAll('g.y-axis-label')
		.data(generators.ay.ticks(h / 100));
	ayLabel.enter().append('g')
		.attr('class', 'label axis-label y-axis-label')
		.attr('transform', yAxisLabelTransform);
	ayLabel.exit().remove();
	ayLabel.selectAll('*').remove();
	ayLabel.transition().duration(200)
		.attr('transform', yAxisLabelTransform);
	ayLabel.append('line')
		.attr('x1', 0)
		.attr('x2', -tickMarkLength.y)
		.attr('y1', 0)
		.attr('y2', 0);
	ayLabel.append('text')
		.attr('x', -axisLabelDistance.y)
		.attr('y', 0)
		.text(function (d, i) {
			if (scaleMode === 1 && String(d).charAt(0) !== '1') {
				return '';
			}
			if (d >= 1e7) {
				return String(Math.floor(d / 1e6)) + 'M';
			} else if (d >= 1e4) {
				return String(Math.floor(d / 1e3)) + 'k';
			} else {
				return String(d);
			}
		});
	/* Line */
	if (opts.line) {
		elements.series
			.transition()
			.duration(200)
			.attr('d', generators.series(data));
	}
	/* Points */
	if (opts.points) {
		var points = elements.plot.selectAll('.data-point')
			.data(data);
		points.enter().append('circle')
			.attr('class', 'data-point')
			.attr('r', '2')
			.attr('cx', generators.ax(range.end))
			.attr('cy', generators.ay(range.min));
		points.exit().remove();
		points.transition().duration(200)
			.attr('cx', function (d, i) { return generators.ax(d.date); })
			.attr('cy', function (d, i) { return generators.ay(d.value); });
	}
	/* Note */
	elements.svg.select('.note')
		.attr('x', generators.ax(range.start))
		.attr('y', opts.note.y)
		.attr('width', generators.ax(range.end) - generators.ax(range.start))
		.attr('height', 70);
}

function dig2(s) {
	s = String(s);
	while (s.length < 2) {
		s = '0' + s;
	}
	return s;
}

})(window, window.d3, document);
