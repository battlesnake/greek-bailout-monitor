(function (window, d3, document) {
'use strict';

var opts = {
	container: 'main>svg',
	margin: {
		left: 100,
		right: 100,
		top: 100,
		bottom: 120
	},
	marginMobile: {
		left: 50,
		right: 20,
		top: 20,
		bottom: 90
	},
	note: {
		y: 30
	},
	axisLabelDistance: {
		x: 10,
		y: 10
	},
	tickMarkLength: {
		x: 7,
		y: 7,
		yminor: 3
	},
	line: true,
	points: true,
	apiTarget: 'https://raw.githubusercontent.com/battlesnake/greek-bailout-monitor/master/greek-log.tsv'
};

var elements = {
	svg: null,
	ax: null,
	ay: null,
	series: null,
	tzinfo: null
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
	elements.tzinfo = elements.svg.append('text').attr('class', 'tzinfo');
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
	setTimeout(refresh, 300000);
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
		range.min = 1e0;
		range.max = 2e9;
		range.end = new Date('2015-07-07T10:30:00+0000');
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
	var margin = window.screen.width > 1024 ? opts.margin : opts.marginMobile;
	var axisLabelDistance = opts.axisLabelDistance;
	var tickMarkLength = opts.tickMarkLength;
	var rc = elements.svg[0][0].getBoundingClientRect();
	var w = rc.right - rc.left;
	var h = rc.bottom - rc.top;
	var data = dataset.data;
	var range = dataset.range;
	/* Geometry generators */
	var generators = {
		ax: d3.time.scale.utc(),
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
		.attr('class', 'tick axis-tick x-axis-tick')
		.attr('x1', 0)
		.attr('x2', 0)
		.attr('y1', 0)
		.attr('y2', tickMarkLength.x);
	axLabel.append('text')
		.attr('class', 'axis-label-text x-axis-label-text')
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
	function isYLogMinor(d) {
		return !/^1(000)*$/.test(String(d));
	}
	ayLabel.append('line')
		.attr('class', 'tick axis-tick y-axis-tick')
		.attr('x1', 0)
		.attr('x2', function (d, i) {
			return (scaleMode === 1 && isYLogMinor(d)) ?
				-tickMarkLength.yminor : -tickMarkLength.y;
		})
		.attr('y1', 0)
		.attr('y2', 0)
		.classed('minor', function (d, i) {
			return isYLogMinor(d);
		});
	ayLabel.append('text')
		.attr('class', 'axis-label-text y-axis-label-text')
		.attr('x', -axisLabelDistance.y)
		.attr('y', 0)
		.text(function (d, i) {
			if (scaleMode === 1 && isYLogMinor(d)) {
				return '';
			}
			if (d >= 1e9) {
				return '€' + String(Math.floor(d / 1e8) / 10) + 'B';
			} else if (d >= 1e6) {
				return '€' + String(Math.floor(d / 1e5) / 10) + 'M';
			} else if (d >= 1e3) {
				return '€' + String(Math.floor(d / 1e2) / 10) + 'k';
			} else {
				return '€' + String(d);
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
			.attr('r', '1')
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
	/* TZINFO */
	elements.tzinfo
		.attr('x', generators.ax((range.start + range.end) / 2))
		.attr('y', h - 10)
		.attr('text-anchor', 'middle')
		.text('Date/times are in UTC');
}

function dig2(s) {
	s = String(s);
	while (s.length < 2) {
		s = '0' + s;
	}
	return s;
}

})(window, window.d3, document);
