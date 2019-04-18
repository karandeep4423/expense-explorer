# expense-explorer

Created to better make sense of my spending.
It reads in a CSV from iExpense (mobile app), and feeds in all expenses into elasticsearch. Aggreagation summaries are then generated based on what a calendar UI helps the user request.

Stack:
- React TS / redux
- Node TS / graphQL API / elasticsearch
- docker / docker-compose


## work on / run

`docker-compose up` to start

## todo

missing/todo:
- render projection on chart
- map dropbox folder in via docker-compose (like I did on python project)
- take latest file from folder, not just first it finds
- mean median mode?
- number display component (takes currency as param), formats with commas and decimals, and displays currency eg. 12 dkk or $12

bigger features:
- filterable table of expenses
- category filter, ie. show a category over time (month/year)
- single expense filter, ie. show a recurring expense over time (lunch/dinner/flights/beer/pad thai)

## usecases

- see a month by month summary of expenses
- for a single expense, see all instances of it
- summary and calendar view
- see a yearly view
- option to omit certain items from a report (like bhutan trip)