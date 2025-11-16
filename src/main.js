const gridSize = 6;
const boxSize = 60;
const emojis = ["⬛", "⬛", "⬛", "🟩", "🟦", "🟥", "🟨"];
const frequencies = [
	8.4966, //A
	2.0716, //B
	4.5388, //C
	3.3844, //D
	11.161, //E
	1.8121, //F
	2.4705, //G
	3.0034, //H
	7.5448, //I
	0.1965, //J
	1.1016, //K
	5.4893, //L
	3.0129, //M
	6.6544, //N
	7.1635, //O
	3.1671, //P
	0.1962, //Q
	7.5809, //R
	5.7351, //S
	6.9509, //T
	3.6308, //U
	1.0074, //V
	1.2899, //W
	0.2902, //X
	1.7779, //Y
	0.2722, //Z
];

const state = {
	seed: "hello",
	score: 0,
	emojiGrid: Array(gridSize)
		.fill()
		.map(() => Array(6).fill("⬛")),
	finished: false,
	dragging: false,
	selecting: false,
	dragStartBox: [0, 0],
	dragEndBox: [0, 0],
	highlightedBoxIndices: [],
	selectedBoxIndex: undefined,
	selectedBoxLetter: "",
};

const saveState = {
	seed: "hello",
	score: 0,
	letterGrid: Array(gridSize)
		.fill()
		.map(() => Array(6).fill("")),
	emojiGrid: Array(gridSize)
		.fill()
		.map(() => Array(6).fill("⬛")),
	finished: false,
};

function drawBoard() {
	const grid = document.getElementById("board");

	for (let row = 0; row < gridSize; row++) {
		for (let col = 0; col < gridSize; col++) {
			drawBox(grid, col, row);
		}
	}
}

function drawBox(container, x, y, letter = "") {
	const cell = document.createElement("div");
	cell.className = "cell";
	const box = document.createElement("div");
	box.className = "box";
	box.id = `box${x}${y}`;
	box.textContent = letter;

	cell.appendChild(box);
	container.appendChild(cell);
	return box;
}

function loadBoardFromSeed(seed) {
	let rng = new Math.seedrandom(seed);
	for (let row = 0; row < gridSize; row++) {
		for (let col = 0; col < gridSize; col++) {
			const box = getBoxFromIndex([col, row]);
			box.textContent = getLetterFromRandom(rng());
		}
	}
}

function loadBoardFromLetterGrid(letterGrid, emojiGrid) {
	for (let row = 0; row < gridSize; row++) {
		for (let col = 0; col < gridSize; col++) {
			const box = getBoxFromIndex([col, row]);

			const l = letterGrid[row][col];
			box.textContent = l.toLowerCase();
			if (l.toUpperCase() === l) box.classList.add("locked");

			const emoji = emojiGrid[row][col];
			if (emoji !== "⬛") {
				box.classList.add("scored");
			}
			if (emoji === "🟩") {
				box.classList.add("length3");
			} else if (emoji === "🟦") {
				box.classList.add("length4");
			} else if (emoji === "🟥") {
				box.classList.add("length5");
			} else if (emoji === "🟨") {
				box.classList.add("length6");
			}
		}
	}
}

function registerEvents() {
	// Register pointer events
	document.addEventListener("mousedown", onDragStart);
	document.addEventListener("mousemove", onDrag);
	document.addEventListener("mouseup", onDragEnd);
	// Add cursor style
	document.getElementById("board").style.cursor = "pointer";

	// Register physical keyboard events
	document.body.onkeydown = (e) => {
		const key = e.key;
		if (isLetter(key)) {
			inputLetter(key);
		}
	};

	// Register on-screen keyboard events
	const keys = document.querySelectorAll(".keyboard-row button");
	for (let i = 0; i < keys.length; i++) {
		keys[i].onclick = (event) => {
			const key = event.target.getAttribute("data-key");
			inputLetter(key);
		};
		// Add cursor style
		keys[i].style.cursor = "pointer";
	}

	// Add resize event
	window.addEventListener("resize", onResize);
}

function deregisterEvents() {
	// First deselect any current selection
	highlightBoxes([]);
	state.selecting = false;
	selectBox(undefined);

	// Unregister pointer events
	document.removeEventListener("mousedown", onDragStart);
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", onDragEnd);
	// Remove cursor style
	document.getElementById("board").style.cursor = "auto";

	// Unregister physical keyboard events
	document.body.onkeydown = (e) => {};

	// Unregister on-screen keyboard events
	const keys = document.querySelectorAll(".keyboard-row button");
	for (let i = 0; i < keys.length; i++) {
		keys[i].onclick = (e) => {};
		// Remove cursor style
		keys[i].style.cursor = "auto";
	}
}

function onResize(event) {
	if (state.highlightedBoxIndices.length > 0) {
		const horizontal =
			state.highlightedBoxIndices.length == 1 ||
			state.highlightedBoxIndices[0][0] !== state.highlightedBoxIndices[1][0];
		highlightBoxes(state.highlightedBoxIndices, horizontal);
	}
}

function onDragStart(event) {
	// If we clicked a button return
	if (event.target.getAttribute("data-key")) return;

	let board = document.getElementById("board");
	let boundingBox = board.getBoundingClientRect();

	// If we clicked off the board, unhighlight and stop selecting.
	if (
		event.clientX < boundingBox.left ||
		event.clientX > boundingBox.right ||
		event.clientY < boundingBox.top ||
		event.clientY > boundingBox.bottom
	) {
		highlightBoxes([]);
		state.selecting = false;
		selectBox(undefined);
		return;
	}

	// Convert the mouse coordinates to box coordinates and get the box
	state.dragStartBox = convertToBoxCoordinates(
		event.clientX,
		event.clientY,
		boundingBox.left,
		boundingBox.top
	);

	let box = getBoxFromIndex(state.dragStartBox);

	// If we are selecting, check if we clicked a highlighted box.
	if (state.selecting && box.classList.contains("highlighted")) {
		// If the box was not locked, select it
		if (!box.classList.contains("locked")) {
			selectBox(state.dragStartBox);
		}
		// Regardless of if the box was locked or not, return
		return;
	}

	// Otherwise, start highlighting
	state.dragging = true;
	selectBox(undefined);

	state.dragEndBox = [state.dragStartBox[0], state.dragStartBox[1]];
	highlightBoxes([state.dragStartBox]);
}

function onDrag(event) {
	if (!state.dragging) return;

	let board = document.getElementById("board");
	let boundingBox = board.getBoundingClientRect();

	// First find the coordinates of the center of the drag start box
	let dragStartCenterX = boundingBox.left + boxSize / 2 + state.dragStartBox[0] * boxSize;
	let dragStartCenterY = boundingBox.top + boxSize / 2 + state.dragStartBox[1] * boxSize;

	// Then clamp the coordinates of the mouse to the grid
	let curX = clamp(event.clientX, boundingBox.left, boundingBox.right);
	let curY = clamp(event.clientY, boundingBox.top, boundingBox.bottom);

	// Then pick the axis that is further away from the drag center to be the
	// primary axis by zeroing out the other axis
	if (Math.abs(curX - dragStartCenterX) > Math.abs(curY - dragStartCenterY)) {
		// Horizontal
		curY = dragStartCenterY;
	} else {
		// Vertical
		curX = dragStartCenterX;
	}

	// Finally convert the modified coordinates to a box index.
	let dragEndBox = convertToBoxCoordinates(curX, curY, boundingBox.left, boundingBox.top);

	if (dragEndBox[0] === state.dragEndBox[0] && dragEndBox[1] === state.dragEndBox[1]) return;

	state.dragEndBox = dragEndBox;
	highlightBoxes(
		getBoxIndicesInLine(state.dragStartBox, dragEndBox),
		state.dragStartBox[0] !== dragEndBox[0]
	);
}

function onDragEnd(event) {
	if (!state.dragging) return;
	state.dragging = false;

	if (state.highlightedBoxIndices.length < 3) {
		highlightBoxes([]);
		return;
	}

	state.selecting = true;
	for (let i = 0; i < state.highlightedBoxIndices.length; i++) {
		const box = getBoxFromIndex(state.highlightedBoxIndices[i]);
		box.classList.add("selectable");
	}
}

// (originX, originY) is the top left corner of the board.
function convertToBoxCoordinates(x, y, originX, originY) {
	let boxIndexX = clamp(Math.floor((x - originX) / boxSize), 0, gridSize - 1);
	let boxIndexY = clamp(Math.floor((y - originY) / boxSize), 0, gridSize - 1);

	return [boxIndexX, boxIndexY];
}

function clamp(number, min, max) {
	return Math.max(min, Math.min(number, max));
}

function getBoxIndicesInLine(box1, box2) {
	let arr = [];
	let horizontal;
	let start, end;
	if (box1[0] === box2[0]) {
		// Vertical
		horizontal = false;
		start = Math.min(box1[1], box2[1]);
		end = Math.max(box1[1], box2[1]);
	} else {
		// Horizontal
		horizontal = true;
		start = Math.min(box1[0], box2[0]);
		end = Math.max(box1[0], box2[0]);
	}

	let boxIndex = [];
	for (let i = start; i <= end; i++) {
		if (!horizontal) boxIndex = [box1[0], i];
		else boxIndex = [i, box1[1]];
		arr.push(boxIndex);
	}
	return arr;
}

function getBoxFromIndex(index) {
	return document.getElementById(`box${index[0]}${index[1]}`);
}

function highlightBoxes(boxIndices, horizontal = true) {
	let boxes = [];
	for (let i = 0; i < boxIndices.length; i++) {
		boxes.push(getBoxFromIndex(boxIndices[i]));
	}

	const highlighter = document.getElementById("highlighter");
	if (boxes.length == 0) highlighter.style.visibility = "hidden";
	else {
		highlighter.style.visibility = "visible";
		highlighter.style.top = boxes[0].getBoundingClientRect().top + "px";
		highlighter.style.left = boxes[0].getBoundingClientRect().left + "px";
	}
	if (horizontal) {
		highlighter.style.height = boxSize + "px";
		highlighter.style.width = boxes.length * boxSize + "px";
	} else {
		highlighter.style.width = boxSize + "px";
		highlighter.style.height = boxes.length * boxSize + "px";
	}

	let box;
	// Un-highlight currently highlighted boxes
	for (let i = 0; i < state.highlightedBoxIndices.length; i++) {
		box = getBoxFromIndex(state.highlightedBoxIndices[i]);
		box.classList.remove("highlighted");
		box.classList.remove("selectable");
	}

	// Highlight new boxes
	for (let i = 0; i < boxes.length; i++) {
		box = boxes[i];
		box.classList.add("highlighted");
	}

	// Update state
	state.highlightedBoxIndices = boxIndices;
}

function selectBox(boxIndex) {
	// Un-select currently selected box
	if (state.selectedBoxIndex) {
		const selectedBox = getBoxFromIndex(state.selectedBoxIndex);
		selectedBox.classList.remove("selected");
		selectedBox.textContent = state.selectedBoxLetter;
	}
	state.selectedBoxIndex = undefined;
	state.selectedBoxLetter = "";

	// Select new box
	if (boxIndex) {
		const box = getBoxFromIndex(boxIndex);
		box.classList.add("selected");
		state.selectedBoxIndex = boxIndex;
		state.selectedBoxLetter = box.textContent;
		box.textContent = "__";
	}
}

function inputLetter(letter) {
	if (!state.selectedBoxIndex) return;

	let word = "";
	for (let i = 0; i < state.highlightedBoxIndices.length; i++) {
		const index1 = state.highlightedBoxIndices[i];
		const index2 = state.selectedBoxIndex;
		if (index1[0] === index2[0] && index1[1] == index2[1]) word += letter;
		else word += getBoxFromIndex(state.highlightedBoxIndices[i]).textContent;
	}

	if (isValidWord(word)) {
		state.selectedBoxLetter = letter;
		const selectedBox = getBoxFromIndex(state.selectedBoxIndex);
		selectedBox.textContent = letter;
		selectedBox.classList.add("locked");

		for (let i = 0; i < state.highlightedBoxIndices.length; i++) {
			const box = getBoxFromIndex(state.highlightedBoxIndices[i]);
			if (!box.classList.contains("scored")) {
				box.classList.add("scored");
				box.classList.add(`length${word.length}`);
				const boxIndex = state.highlightedBoxIndices[i];
				state.emojiGrid[boxIndex[1]][boxIndex[0]] = emojis[word.length];
				state.score += word.length;
			}
		}

		updateScore();
		save();
	}

	highlightBoxes([]);
	selectBox(undefined);
	state.selecting = false;
}

function updateScore() {
	const scores = document.getElementsByClassName("score");
	for (let i = 0; i < scores.length; i++) {
		scores[i].textContent = state.score;
	}
}

function isLetter(key) {
	return key.length === 1 && key.match(/[a-z]/i);
}

function getLetterFromRandom(r) {
	r *= 100;
	let i = 0;
	let sum = 0;

	while (r > sum) {
		sum += frequencies[i];
		i++;
	}

	return String.fromCharCode(97 + (i - 1));
}

function isValidWord(word) {
	if (word.length < 3 || word.length > gridSize) {
		return false;
	}

	return binarySearch(dictionary, word.toLowerCase());
}

function binarySearch(dict, word) {
	let low = 0;
	let high = dict.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const guess = dict[mid];

		if (guess === word) {
			return true;
		} else if (guess < word) {
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return false;
}

function save() {
	for (let row = 0; row < gridSize; row++) {
		for (let col = 0; col < gridSize; col++) {
			const box = getBoxFromIndex([col, row]);
			if (box.classList.contains("locked")) {
				saveState.letterGrid[row][col] = box.textContent.toUpperCase();
			} else {
				saveState.letterGrid[row][col] = box.textContent;
			}
		}
	}
	saveState.finished = state.finished;
	saveState.score = state.score;
	saveState.emojiGrid = state.emojiGrid;
	saveState.seed = state.seed;

	localStorage.setItem("state", JSON.stringify(saveState));
}

function load() {
	const savedString = localStorage.getItem("state");
	// If there is no saved state return
	if (!savedString) {
		return false;
	}
	const parsedState = JSON.parse(savedString);
	// If the saved state has the wrong seed return
	if (parsedState.seed !== state.seed) {
		localStorage.removeItem("state");
		return false;
	}

	state.finished = parsedState.finished;
	state.score = parsedState.score;
	state.emojiGrid = parsedState.emojiGrid;
	state.seed = parsedState.seed;

	if (parsedState.finished) {
		endGame(false);
	}

	loadBoardFromLetterGrid(parsedState.letterGrid, parsedState.emojiGrid);
	updateScore();

	return true;
}

function copyResults() {
	let copyText = `Jorybord\n${state.seed}\nScore: ${state.score}\n`;
	//let copyText = "Score: " + state.score + ;
	for (let row = 0; row < gridSize; row++) {
		for (let col = 0; col < gridSize; col++) {
			copyText += state.emojiGrid[row][col];
		}
		copyText += "\n";
	}
	navigator.clipboard.writeText(copyText);
	window.alert("Copied text to clipboard");
}

function openResults() {
	document.getElementById("results").classList.add("open");
	const emojiRows = document.getElementById("emojis").children;
	for (let i = 0; i < emojiRows.length; i++) {
		let e = "";
		for (let j = 0; j < gridSize; j++) {
			e += state.emojiGrid[i][j];
		}
		emojiRows[i].textContent = e;
	}
	deregisterEvents();
}

function closeResults() {
	document.getElementById("results").classList.remove("open");
}

function doneButton() {
	if (state.finished) {
		openResults();
	} else {
		document.getElementById("confirm").classList.add("open");
		deregisterEvents();
	}
}

function endGame(saveGame = true) {
	openResults();
	state.finished = true;
	document.getElementById("confirm").classList.remove("open");
	document.getElementById("done").textContent = "Show results";
	if (saveGame) save();
}

function closeConfirm() {
	document.getElementById("confirm").classList.remove("open");
	registerEvents();
}

function startup() {
	const date = new Date();
	const dateString = date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	state.seed = dateString;

	registerEvents();
	drawBoard();
	if (!load()) {
		loadBoardFromSeed(state.seed);
	}
}

startup();
