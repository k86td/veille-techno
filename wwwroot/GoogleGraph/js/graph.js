console.debug("Script initialize");

// class to encapsulate api requests and cache them in local storage
class ApiHelper {
	constructor(url) {
		this.url = url;
	}
}

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

document.getElementById("city_refresh_btn").onclick = _ => {
	drawChart();
};

async function drawChart() {
	let city_name = $("#city_input").val();
	let lat = 45.62;
	let lng = -73.99;

	let geocode_api_url = `https://geocode.maps.co/search?q=${city_name}`;

	let geocode_data = await fetch(geocode_api_url);
	geocode_data = await geocode_data.json();
	geocode_data = geocode_data[0]; // take the first location we found... could be problematic

	lat = geocode_data.lat;
	lng = geocode_data.lon;

	let api_url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=temperature_2m`;

	let api_data = await fetch(api_url);
	api_data = await api_data.json();

	console.debug("Drawing chart");

	let data = new google.visualization.DataTable();

	data.addColumn('string', 'Date and time');
	data.addColumn('number', 'Open Meteo Temperature');

	api_data.hourly.time.forEach((el, ind) => {
		data.addRows([[el, api_data.hourly.temperature_2m[ind]]]);
	});

	let opts = {
		'title': "Meteo",
		'width': 1000,
		'height': 500,
		'backgroundColor': {
			'fill': "#1e1e1e"
		},
		'hAxis': {
			'textStyle': {
				'color': "#898989",
				'fontName': 'JetBrains Mono'
			}
		},
		'display': 'block',
		'margin': '1 auto',
		...defaultStyle
	};

	let chart = new google.visualization.LineChart(document.getElementById('chart_container'));
	chart.draw(data, opts);
}


