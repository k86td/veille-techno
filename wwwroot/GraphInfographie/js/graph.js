
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

function drawLine(container_selector, x1, y1, x2, y2, width = 1, colour = "black", linecap = "square") {
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

function drawText(container_selector, text, x, y, text_anchor = "start", font_size = 16, align_middle = true) {
	let line = document.createElementNS(svgns, 'text');

	line.innerHTML = text;
	line.setBulkAttributes({
		"id": `text_${uuidv4()}`,
		"x": x,
		"y": align_middle ? y + font_size / 4 : y,
		"text-anchor": text_anchor,
		"font-size": font_size
	});

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

	captionRows(min_value, max_value, draw_x = this.x1, append_symbol = '') {
		if (!this.data.rows) {
			console.error("You have to create rows first!");
			return;
		}

		let remapper = (val) => {
			return (((val - 0) * (max_value - min_value)) / (max_value - 0)) + min_value;
		};

		let row_count = this.data.rows.count;
		let len_between_rows = Math.abs(this.y2 - this.y1) / row_count;
		// - 1 to ignore base line
		let decrement_count = max_value / (row_count - 1);
		for (let x = 1; x <= row_count; x++) {
			let curY = len_between_rows * x;
			let captionText;

			captionText = max_value - remapper((x - 1) * decrement_count);

			drawText(this.selector, `${append_symbol}${captionText}`, draw_x, curY, "end");
		}
	}
}

