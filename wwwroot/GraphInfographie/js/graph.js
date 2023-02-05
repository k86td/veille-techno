
const svgns = "http://www.w3.org/2000/svg";

Object.prototype.setBulkAttributes = function(attributes) {
	Object.keys(attributes).forEach(key => {
		this.setAttribute(key, attributes[key]);
	});
}

function uuidv4() {
	return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
}

function drawLine(container_selector, x1, y1, x2, y2, width = 1, colour = "white", linecap = "square") {
	let line = document.createElementNS(svgns, 'line');

	line.setBulkAttributes({
		"id": `line_${uuidv4()}`,
		"x1": x1,
		"y1": y1,
		"x2": x2,
		"y2": y2,
		"stroke": colour,
		"stroke-width": width,
		"linecap": linecap
	});

	$(container_selector).append(line);
}


function drawText(container_selector, text, x, y, additional_attributes = {}) {
	let line = document.createElementNS(svgns, 'text');

	let default_settings = {
		"font-size": 16
	};
	additional_attributes = { ...default_settings, ...additional_attributes };

	line.innerHTML = text;
	line.setBulkAttributes({
		"id": `text_${uuidv4()}`,
		"x": x,
		"y": y + parseInt(additional_attributes['font-size'] ?? default_settings['font-size']) / 4,
	});

	if (additional_attributes)
		line.setBulkAttributes(additional_attributes);

	$(container_selector).append(line);
}

function drawRectangle(container_selector, x, y, width, height, additional_attributes = {}) {
	let line = document.createElementNS(svgns, 'rect');

	let default_settings = {
		"style": "fill:red;"
	};
	additional_attributes = { ...default_settings, ...additional_attributes };

	line.setBulkAttributes({
		"id": `rect_${uuidv4()}`,
		"x": x,
		"y": y,
		"width": width,
		"height": height
	});

	if (additional_attributes)
		line.setBulkAttributes(additional_attributes);

	$(container_selector).append(line);
}

function oldDrawText(container_selector, text, x, y, text_anchor = "start", font_size = 16, align_middle = true, additional_attributes = null) {
	let line = document.createElementNS(svgns, 'text');

	line.innerHTML = text;
	line.setBulkAttributes({
		"id": `text_${uuidv4()}`,
		"x": x,
		"y": align_middle ? y + font_size / 4 : y,
		"text-anchor": text_anchor,
		"font-size": font_size
	});

	if (additional_attributes)
		line.setBulkAttributes(...additional_attributes);

	$(container_selector).append(line);
}

class Graph {
	constructor(selector, width, height, x1 = 0, y1 = 0, x2 = width, y2 = height) {
		this.selector = selector;
		this.width = width;
		this.height = height;
		this.x1 = x1;
		this.x2 = x2;
		this.y1 = y1;
		this.y2 = y2;

		this.data = {
			rows: null,
			columns: null
		};
	}

	clear() {
		this.data.rows = null;
		this.data.columns = null
		$(this.selector).empty();
	}

	createRows(number_of_rows = 2, interval_between = 1, row_width = 1, interval_width = 0.25) {
		if (this.data.rows) {
			console.error("Rows are already defined! Call .clear() first");
			return;
		}
		else
			this.data.rows = {
				count: number_of_rows,
				interval_between_count: interval_between
			}

		// create rows
		let len_between_rows = Math.abs(this.y2 - this.y1) / number_of_rows;
		let len_interval_between = len_between_rows / (interval_between + 1);

		for (let x = 1; x <= number_of_rows; x++) {
			let curY = len_between_rows * x;
			drawLine(this.selector, this.x1, curY, this.x2, curY, row_width);

			if (x < number_of_rows)
				for (let y = 1; y <= interval_between; y++) {
					let intY = y * len_interval_between + curY;
					drawLine(
						this.selector,
						this.x1,
						intY,
						this.x2,
						intY,
						interval_width
					);
				}
		}
	}

	createColumns(number_of_cols, margin_border_graph = 10, margin_between = 10) {
		if (this.data.columns) {
			console.error("You have to .clear() the graph first, columns already exists");
			return;
		}

		this.data.columns = {
			"count": number_of_cols,
			"col_width": [],
			"column_middle": []
		};

		let width_cols = Math.abs((this.x2 - this.x1) - (2 * margin_border_graph)) / (number_of_cols);

		for (let x = 0; x < number_of_cols; x++) {
			let offset = margin_border_graph + (x * width_cols);

			let x1 = this.x1 + offset + margin_between / 2;
			let x2 = this.x1 + width_cols + offset - margin_between / 2;

			this.data.columns.column_middle.push((x1 + x2) / 2);

			let col_width = { 'x1': x1, 'x2': x2, 'y': this.y2 };
			this.data.columns.col_width.push(col_width);

			// debug column width
			// drawLine(
			// 	"#svgContainer",
			// 	x1,
			// 	this.y2,
			// 	x2,
			// 	this.y2,
			// 	5,
			// 	"#" + Math.floor(Math.random() * 16777215).toString(16)
			// );
		}
	}

	captionColumns(column_names_array, y_base) {
		if (column_names_array.length != this.data.columns.count) {
			console.error("You tried to caption with the wrong array size, should be",
				this.data.columns.count);
			return;
		}

		this.data.columns.column_middle.forEach((col_mid, ind) => {
			drawText("#svgContainer", column_names_array[ind], col_mid, y_base,
				{ "transform": `rotate(45, ${col_mid}, ${y_base})`, "font-size": 20, "fill": "white" });
		});
	}

	addColumnData(column_number, column_value, color = "red") {
		if (column_number > this.data.columns.col_width) {
			console.error("Outbound of the setted columns!");
			return;
		}

		// calculate data
		let chosen_width = this.data.columns.col_width[column_number];
		let max_value_y_inverted = Math.abs(this.y2 - this.y1) - this.data.rows.max_value.y;
		let column_height = max_value_y_inverted / this.data.rows.max_value.max * column_value;
		let y_value = chosen_width.y - column_height;


		drawRectangle(
			this.selector,
			chosen_width.x1,
			y_value,
			chosen_width.x2 - chosen_width.x1,
			column_height,
			{ "style": `fill:${color};stroke-width:1;stroke:white;` }
		);

		drawText(
			this.selector,
			`${this.data.rows.max_value.symbol}${column_value}`,
			(chosen_width.x2 + chosen_width.x1) / 2,
			y_value - 10,
			{ 'text-anchor': 'middle', 'fill': 'white' }
		);

	}

	// TODO add support for dynamic min_value
	captionRows(max_value, draw_x = this.x1, append_symbol = '') {
		if (!this.data.rows) {
			console.error("You have to create rows first!");
			return;
		}

		let min_value = 0;

		let remapper = (val) => {
			return Math.floor(
				(((val - 0) * (max_value - min_value)) / (max_value - 0)) + min_value
			);
		};

		let row_count = this.data.rows.count;
		let len_between_rows = Math.abs(this.y2 - this.y1) / row_count;
		this.data.rows.max_value = { "max": max_value, "y": len_between_rows, "symbol": append_symbol };

		// - 1 to ignore base line
		let decrement_count = max_value / (row_count - 1);
		for (let x = 1; x <= row_count; x++) {
			let curY = len_between_rows * x;
			let captionText;

			captionText = max_value - remapper((x - 1) * decrement_count);

			drawText(this.selector, `${append_symbol}${captionText}`, draw_x, curY, { 'text-anchor': 'end', 'fill': 'white' });
		}
	}
}

// test 1
// let g = new Graph("#svgContainer", 1000, 1000, 100, 0, 1000, 1000);
// g.createRows(8, 9);
// g.captionRows(0, 7000, 90, "$ ");

// MAIN CODE //
// this generates the graph 
const [width, height] = [1000, 1000];
const [x1, y1, x2, y2] = [100, 0, 1000, 1000];

let g = new Graph("#svgContainer", width, height, x1, y1, x2, y2);
g.createRows(8, 9);
g.captionRows(7000, x1 - 10, "$ ");
g.createColumns(12);
g.captionColumns(["January", "February", "Mars", "April", "May", "June", "July", "August", "September", "October", "November", "December"], y2 + 25);

let dataGeneratorFunc = (dataArr, colorArr) => {
	let numColors = colorArr.length;

	let interval = (Math.max(...dataArr) - Math.min(...dataArr)) / numColors;

	console.debug(interval);

	dataArr.forEach((val, ind) => {
		let colorInd = Math.floor(val / interval)

		if (colorInd >= numColors)
			colorInd = numColors - 1;

		console.debug(`Color Index: ${colorInd} (${colorArr[colorInd]})`);
		g.addColumnData(ind, val, colorArr[colorInd]);
	});
};

dataGeneratorFunc([
	6500,
	5550,
	4200,
	4525,
	2500,
	1500,
	500,
	1000,
	1750,
	2300,
	3700,
	3500,
], ['red', 'orange', 'yellow', 'green']);

// let columnData = [
// 	[6500, 'green'],
// 	[5550, 'green'],
// 	[4200, 'yellow'],
// 	[4525, 'green'],
// 	[2500, 'orange'],
// 	[1500, 'orange'],
// 	[500, 'red'],
// 	[1000, 'red'],
// 	[1750, 'orange'],
// 	[2300, 'orange'],
// 	[3700, 'yellow'],
// 	[3500, 'yellow']
// ].forEach((val, ind) => {
// 	g.addColumnData(ind, val[0], val[1]);
// });

