console.debug("Script initialize");

const defaultStyle = {
	'legend': {
		'textStyle': {
			'color': "#898989",
			'fontName': 'JetBrains Mono'
		}
	},
	'titleTextStyle': {
		'color': "#898989",
		'fontName': 'JetBrains Mono'
	}
}

google.charts.load('current', { 'packages': ['corechart'] });

google.charts.setOnLoadCallback(drawChart);


function drawChart() {
	console.debug("Drawing chart");

	let data = new google.visualization.DataTable();

	data.addColumn('string', 'Topping');
	data.addColumn('number', 'Count');

	data.addRows([
		['Mushrooms', 3],
		['Olives', 1],
		['Onions', 3]
	]);

	let opts = {
		'title': "Test chart",
		'width': 400,
		'height': 300,
		'backgroundColor': {
			'fill': "#1e1e1e"
		},
		...defaultStyle
	};

	let chart = new google.visualization.PieChart(document.getElementById('chart_container'));
	chart.draw(data, opts);
}


