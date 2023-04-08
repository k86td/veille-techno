use std::{
    error::Error,
    io,
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

use rand::Rng;
use std::str::FromStr;

use crossterm::{
    event::{self, KeyCode},
    terminal::{disable_raw_mode, enable_raw_mode},
};
use reqwest::{Client, ClientBuilder, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tui::{
    backend::CrosstermBackend,
    layout::{Alignment, Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    terminal::Terminal,
    text::{Span, Spans},
    widgets::{
        Block, BorderType, Borders, Cell, List, ListItem, ListState, Paragraph, Row, Table, Tabs,
        Widget,
    },
};
use tui_textarea::TextArea;

enum Event<I> {
    Input(I),
    Tick,
}

#[derive(Clone, Copy, Debug)]
enum MenuItem {
    Home,
    AddDocument,
    Documents,
}

impl From<MenuItem> for usize {
    fn from(value: MenuItem) -> Self {
        match value {
            MenuItem::Home => 0,
            MenuItem::AddDocument => 1,
            MenuItem::Documents => 2,
        }
    }
}

fn validate_csv(input: &mut TextArea) -> bool {
    let objs: Vec<&str> = input.lines()[0].split(',').collect();

    /*
                   titre,disponible,type(book,recurring)
                   book: ,year,maisonEdition,auteur,[1,2,3]
                   reccuring: ,time(weekly,monthly,daily),date
    */

    match objs.clone().len() {
        1 => {
            input.set_block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Red))
                    .title("Missing Title"),
            );
            false
        }
        2 => {
            input.set_block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Red))
                    .title("Missing Disponibility"),
            );
            false
        }
        3..=7 => {
            let mut res = false;
            match objs[2] {
                "book" => match objs.len() {
                    4 => {
                        input.set_block(
                            Block::default()
                                .borders(Borders::ALL)
                                .border_style(Style::default().fg(Color::Red))
                                .title("Missing year"),
                        );
                    }
                    5 => {
                        input.set_block(
                            Block::default()
                                .borders(Borders::ALL)
                                .border_style(Style::default().fg(Color::Red))
                                .title("Missing publishing house"),
                        );
                    }
                    6 => {
                        input.set_block(
                            Block::default()
                                .borders(Borders::ALL)
                                .border_style(Style::default().fg(Color::Red))
                                .title("Missing author"),
                        );
                    }
                    7 => {
                        input.set_block(
                            Block::default()
                                .borders(Borders::ALL)
                                .border_style(Style::default().fg(Color::Yellow))
                                .title("Missing quantity"),
                        );

                        res = true;
                    }
                    _ => {
                        input.set_block(
                            Block::default()
                                .borders(Borders::ALL)
                                .border_style(Style::default().fg(Color::Red))
                                .title("Couldn't parse book"),
                        );
                    }
                },
                "recurring" => match objs.len() {
                    _ => {
                        input.set_block(
                            Block::default()
                                .borders(Borders::ALL)
                                .border_style(Style::default().fg(Color::Red))
                                .title("Couldn't parse recurring"),
                        );
                    }
                },
                _ => {
                    input.set_block(
                        Block::default()
                            .borders(Borders::ALL)
                            .border_style(Style::default().fg(Color::Red))
                            .title("Type should be 'book' or 'recurring'"),
                    );
                }
            };

            res
        }
        _ => false,
    }
}

fn home<'a>() -> Paragraph<'a> {
    let home = Paragraph::new(vec![
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw("Library Manager 2023")]),
        Spans::from(vec![Span::raw("")]),
        Spans::from(vec![Span::raw(
            "Press 'b' to insert a new book, 'a' to insert a recurring article, 'r' to research or 'q' to quit",
        )]),
    ])
    .alignment(Alignment::Center)
    .block(
        Block::default()
            .borders(Borders::ALL)
            .style(Style::default().fg(Color::White))
            .title("Home")
            .border_type(BorderType::Rounded),
    );

    home
}

/*
               titre,disponible,type(book,recurring)
               book: ,year,maisonEdition,auteur,[1,2,3]
               reccuring: ,time(weekly,monthly,daily),date
*/

#[derive(Debug, Clone)]
struct Book {
    pub title: String,
    pub available: bool,
    pub document_type: String,
    pub year: u32,
    pub publishing_house: String,
    pub author: String,
    pub publishes: Vec<u32>,
}

impl Book {
    async fn get_filtered(document_type: &str) -> Result<Vec<Book>, Box<dyn Error>> {
        let query = json!({
            "selector": {
                "document_type": document_type
            }
        });

        let url = String::from(format!(
            "http://admin:MySecurePassword@localhost:5984/documents/_find"
        ));

        let client = reqwest::Client::new();
        let response = client
            .post(url)
            .header("Content-Type", "application/json")
            .body(query.to_string())
            .send()
            .await?;

        let json: Value = serde_json::from_str(&response.text().await?)?;

        let books: Vec<Book> = json["docs"]
            .as_array()
            .ok_or("docs not found")?
            .iter()
            .map(|doc| {
                let title = doc.get("title").and_then(|v| v.as_str()).unwrap_or("");
                let available = doc
                    .get("available")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let document_type = doc
                    .get("document_type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let year = doc.get("year").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let publishing_house = doc
                    .get("publishing_house")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let author = doc.get("author").and_then(|v| v.as_str()).unwrap_or("");
                let publishes = doc
                    .get("publishes")
                    .and_then(|v| v.as_array())
                    .map(|v| {
                        v.iter()
                            .filter_map(|e| e.as_u64().map(|u| u as u32))
                            .collect()
                    })
                    .unwrap_or_else(|| vec![]);

                Book {
                    title: title.into(),
                    available,
                    document_type: document_type.into(),
                    year,
                    publishing_house: publishing_house.into(),
                    author: author.into(),
                    publishes,
                }
            })
            .collect();

        Ok(books)
    }
}

impl FromStr for Book {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let fields: Vec<&str> = s.split(',').collect();

        if fields.len() != 7 {
            return Err("invalid number of fields".to_string());
        }

        let title = fields[0].to_string();
        let available = match fields[1] {
            "true" => true,
            "false" => false,
            _ => return Err("invalid available field".to_string()),
        };
        let document_type = "book".to_string();
        let year = match fields[3].parse() {
            Ok(year) => year,
            Err(_) => return Err("invalid year field".to_string()),
        };
        let publishing_house = fields[4].to_string();
        let author = fields[5].to_string();
        let publishes_count = match fields[6].parse() {
            Ok(count) => count,
            Err(_) => return Err("invalid publishes field".to_string()),
        };
        let mut rng = rand::thread_rng();
        let publishes: Vec<u32> = (0..publishes_count).map(|_| rng.gen()).collect();

        Ok(Book {
            title,
            available,
            document_type,
            year,
            publishing_house,
            author,
            publishes: publishes.try_into().unwrap(),
        })
    }
}

impl Book {
    async fn store(&self) -> Result<(), String> {
        let url = "http://admin:MySecurePassword@localhost:5984/documents";

        let client = ClientBuilder::new();
        let book_json = json!({
            "title": self.title,
            "available": self.available,
            "document_type": self.document_type,
            "year": self.year,
            "publishing_house": self.publishing_house,
            "author": self.author,
            "publishes": self.publishes,
        });
        let response = client
            .build()
            .unwrap()
            .post(url)
            .header("Content-Type", "application/json")
            .body(book_json.to_string())
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status() != reqwest::StatusCode::CREATED {
            let body = response.text().await.unwrap_or_else(|_| "".to_string());
            return Err(format!("error storing book: {}", body));
        }

        Ok(())
    }
}

fn documents<'a>(document_state: &ListState, books: Vec<Book>) -> (List<'a>, Table<'a>) {
    let document_types = ["book", "recurring"];
    let document_types_view = Block::default()
        .borders(Borders::ALL)
        .style(Style::default().fg(Color::White))
        .title("Document Types")
        .border_type(BorderType::Rounded);

    let document_items: Vec<_> = document_types
        .iter()
        .map(|document| {
            ListItem::new(Spans::from(vec![Span::styled(
                document.clone(),
                Style::default(),
            )]))
        })
        .collect();

    let selected_document_item = document_types
        .get(
            document_state
                .selected()
                .expect("there is always a document_type selected"),
        )
        .expect("exists")
        .clone();

    let document_type_list = List::new(document_items)
        .block(document_types_view)
        .highlight_style(
            Style::default()
                .bg(Color::Yellow)
                .fg(Color::Black)
                .add_modifier(Modifier::BOLD),
        );

    let mut document_table = match selected_document_item {
        "book" => Table::new(books.into_iter().map(|book| {
            Row::new(vec![
                Cell::from(Span::raw(book.title)),
                Cell::from(Span::raw(book.year.to_string())),
                Cell::from(Span::raw(book.author)),
            ])
        })),
        "recurring" => Table::new(vec![Row::new(vec![
            Cell::from(Span::raw("-")),
            Cell::from(Span::raw("-")),
            Cell::from(Span::raw("-")),
        ])]),
        _ => panic!("undefined table for type"),
    };

    document_table = document_table
        .block(
            Block::default()
                .borders(Borders::ALL)
                .style(Style::default().fg(Color::White))
                .title("Document List")
                .border_type(BorderType::Rounded),
        )
        .header(Row::new(vec![
            Cell::from(Span::styled(
                "Title",
                Style::default().add_modifier(Modifier::BOLD),
            )),
            Cell::from(Span::styled(
                "Year",
                Style::default().add_modifier(Modifier::BOLD),
            )),
            Cell::from(Span::styled(
                "Author",
                Style::default().add_modifier(Modifier::BOLD),
            )),
        ]))
        .widths(&[
            Constraint::Percentage(30),
            Constraint::Percentage(20),
            Constraint::Percentage(50),
        ]);
    (document_type_list, document_table)
}

#[tokio::main]
async fn main() {
    enable_raw_mode().expect("can run in raw mode");

    let (tx, rx) = mpsc::channel();
    let tick_rate = Duration::from_millis(200);
    thread::spawn(move || {
        let mut last_tick = Instant::now();
        loop {
            let timeout = tick_rate
                .checked_sub(last_tick.elapsed())
                .unwrap_or_else(|| Duration::from_secs(0));

            if event::poll(timeout).expect("poll works") {
                if let crossterm::event::Event::Key(key) = event::read().expect("can read events") {
                    tx.send(Event::Input(key)).expect("can send events");
                }
            }

            if last_tick.elapsed() >= tick_rate {
                if let Ok(_) = tx.send(Event::Tick) {
                    last_tick = Instant::now();
                }
            }
        }
    });

    let stdout = io::stdout();
    let backend = CrosstermBackend::new(stdout);
    let mut term = Terminal::new(backend).expect("can create terminal");

    term.clear().expect("can clear terminal");

    let mut input_book = TextArea::default();
    let mut csv_input = String::new();
    let mut input_mode = false;

    let titles = vec!["Home", "Add document", "Documents", "Quit"];
    let mut active = MenuItem::Home;
    let mut document_state = ListState::default();
    document_state.select(Some(0));
    let mut all_books = Book::get_filtered("book").await.unwrap();

    loop {
        term.draw(|rect| {
            let size = rect.size();
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .margin(2)
                .constraints(
                    [
                        Constraint::Length(3),
                        Constraint::Min(2),
                        Constraint::Length(3),
                    ]
                    .as_ref(),
                )
                .split(size);

            let menu = titles
                .iter()
                .map(|titles| {
                    let (f, r) = titles.split_at(1);
                    Spans::from(vec![
                        Span::styled(
                            f,
                            Style::default()
                                .fg(Color::Yellow)
                                .add_modifier(Modifier::UNDERLINED),
                        ),
                        Span::styled(r, Style::default().fg(Color::White)),
                    ])
                })
                .collect();

            let tabs = Tabs::new(menu)
                .select(active.into())
                .block(Block::default().title("Menu").borders(Borders::ALL))
                .style(Style::default().fg(Color::Yellow))
                .divider(Span::raw("|"));

            let about = Paragraph::new("library-tui 2023 - by Tristan Lepine")
                .style(Style::default().fg(Color::Gray))
                .alignment(Alignment::Center)
                .block(
                    Block::default()
                        .borders(Borders::ALL)
                        .style(Style::default().fg(Color::White))
                        .title("About")
                        .border_type(BorderType::Plain),
                );

            match active {
                MenuItem::Home => rect.render_widget(home(), chunks[1]),
                MenuItem::AddDocument => {
                    input_book.set_cursor_line_style(Style::default());

                    let input_layout = Layout::default()
                        .constraints([Constraint::Length(3), Constraint::Min(1)].as_slice())
                        .split(chunks[1]);

                    if !input_mode {
                        input_book.set_block(
                            Block::default()
                                .borders(Borders::ALL)
                                .border_style(Style::default().fg(Color::White))
                                .title("Csv Input"),
                        );
                    }

                    rect.render_widget(
                        input_book.widget(),
                        *input_layout.first().expect("can get layout"),
                    );
                }
                MenuItem::Documents => {
                    let document_views = Layout::default()
                        .direction(Direction::Horizontal)
                        .constraints([Constraint::Percentage(20), Constraint::Percentage(80)])
                        .split(chunks[1]);
                    let (left, right) = documents(&document_state, all_books.clone());
                    rect.render_stateful_widget(left, document_views[0], &mut document_state);
                    rect.render_widget(right, document_views[1]);
                }
            }

            rect.render_widget(tabs, chunks[0]);
            rect.render_widget(about, chunks[2]);
        })
        .expect("Impossible to draw frame");

        if !input_mode {
            match rx.recv().expect("Can't read rx.recv") {
                Event::Input(event) => match event.code {
                    KeyCode::Char('q') => {
                        disable_raw_mode().expect("Can't disable raw mode");
                        term.show_cursor().expect("Can't show terminal cursor");
                        break;
                    }
                    KeyCode::Char('i') => {
                        input_mode = true;
                        validate_csv(&mut input_book);
                    }
                    KeyCode::Char('h') => active = MenuItem::Home,
                    KeyCode::Char('a') => active = MenuItem::AddDocument,
                    KeyCode::Char('d') => active = MenuItem::Documents,
                    KeyCode::Down => {
                        if let Some(selected) = document_state.selected() {
                            if selected == 0 {
                                document_state.select(Some(1));
                            }
                        }
                    }
                    KeyCode::Up => {
                        if let Some(selected) = document_state.selected() {
                            if selected == 1 {
                                document_state.select(Some(0));
                            }
                        }
                    }
                    _ => {}
                },
                Event::Tick => {}
            }
        } else {
            match rx.recv().expect("Can't read rx.recv") {
                Event::Input(event) => match event.code {
                    KeyCode::Esc => {
                        input_mode = false;
                        csv_input = String::new();
                    }
                    KeyCode::Enter => {
                        if validate_csv(&mut input_book) {
                            input_mode = false;
                            csv_input = String::from(&input_book.lines()[0]);
                            input_book = TextArea::default();

                            let created_book: Book = csv_input.parse().unwrap();
                            created_book.store().await.unwrap();
                            all_books = Book::get_filtered("book").await.unwrap();
                        }
                    }
                    _ => {
                        if input_book.input(event) {
                            validate_csv(&mut input_book);
                        };
                    }
                },
                Event::Tick => {}
            }
        }
    }

    term.clear().expect("Can't clear terminal");
}
