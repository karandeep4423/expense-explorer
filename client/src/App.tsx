import { Expense, Filter, Summary, TimeUnit } from '@shared/declarations'
import * as moment from 'moment'
import * as React from 'react'
// @ts-ignore
import { Line as LineChart, Pie as PieChart } from 'react-chartjs'
import { connect } from 'react-redux'
import 'src/App.css'
import CategoryExpenses from 'src/components/CategoryExpenses'
import ExpenseTable from 'src/components/ExpenseTable'
import NumberDisplay from 'src/components/NumberDisplay'
import {
	Action,
	changeMonth,
	changeScope,
	getSummary,
	setBudget,
	setFilter,
} from 'src/redux/actions'
import { Store } from 'src/redux/store'
import './../node_modules/semantic-ui-css/semantic.min.css'

interface IAppProps {
	nYearlyBudget?: number
	initialDate: moment.Moment
	filter: Filter
	oSummary: Summary
	sScope: string
	changeMonth: (bBackwards: boolean) => {}
	changeScope: (sScope: string) => {}
	getSummary: (iDate: moment.Moment) => {}
	setBudget: (fYearlyBudget: number) => {}
	setFilter: (oSummary: Filter | null) => {}
}

class App extends React.Component<IAppProps, {}> {
	public renderError() {
		return '...no data.. (loading?)'
	}

	public renderScopeInputUI() {
		const { sScope } = this.props
		return (
			<div className="ui small buttons">
				<button
					onClick={() => this.eChangeScope('month')}
					className={
						'ui button' + (sScope === 'month' ? ' active' : '')
					}
				>
					month
				</button>
				<div className="or" />
				<button
					onClick={() => this.eChangeScope('year')}
					className={
						'ui button' + (sScope === 'year' ? ' active' : '')
					}
				>
					year
				</button>

				<div className="or" />
				<button
					onClick={() => this.eChangeScope('custom')}
					className={
						'ui button' + (sScope === 'custom' ? ' active' : '')
					}
				>
					custom
				</button>
			</div>
		)
	}

	public renderDateInputUI() {
		return (
			<div className="ui small buttons right floated">
				<button
					className="ui labeled icon button"
					onClick={() => this.eChangeMonth(true)}
				>
					<i className="left chevron icon" />
					Back
				</button>
				<button
					className="ui right labeled icon button"
					onClick={() => this.eChangeMonth(false)}
				>
					Forward
					<i className="right chevron icon" />
				</button>
			</div>
		)
	}

	public renderEverything() {
		const { initialDate, filter, oSummary, sScope } = this.props
		const {
			spendingByCategory,
			spendingBySubcategory,
			spendingOverTime,
			expenses,
			totalExpenditure,
		}: Summary = oSummary
		return (
			<div className="App ui container">
				<h1>expense explorer</h1>
				<div className="ui grid">
					<div className="three column row">
						<div className="column">
							{/* month / year changer */}
							{this.renderScopeInputUI()}
						</div>
						<div className="column centered-text">
							{/* current period */}
							<h2>
								{this.renderScopeLabel(initialDate, sScope)}
								{filter && (
									<span>
										&nbsp;(&nbsp;
										{filter.term}:{filter.match}
										<a onClick={() => this.eRemoveFilter()}>
											<i className="icon trash" />
										</a>
										&nbsp;)
									</span>
								)}
							</h2>
						</div>
						<div className="column">
							{/* date navigation */}
							{this.renderDateInputUI()}
						</div>
					</div>
				</div>

				{/* render expenses for current date */}
				{/* {totalExpenditure > 0 && ( */}
				{!!totalExpenditure && totalExpenditure > 0 && spendingOverTime && spendingByCategory && spendingBySubcategory && expenses && oSummary.averagePerUnit && (
					<div>
						<br />
						{this.renderSummary()}
						{this.renderSpendingOverTime(spendingOverTime)}
						<br />
						<CategoryExpenses
							categories={spendingByCategory}
							eSetFilter={this.eSetFilter}
							sCategoryName={'Category'}
						/>
						<br />
						<CategoryExpenses
							categories={spendingBySubcategory}
							eSetFilter={this.eSetFilter}
							sCategoryName={'Subcategory'}
						/>
						<br />
						{this.renderExpenses(expenses)}
					</div>
				)}
				{totalExpenditure === 0 && (
					<div>
						<br />
						<h2 className="centered-text">
							no expense data for current period..
						</h2>
					</div>
				)}
			</div>
		)
	}

	public render() {
		return this.props.oSummary
			? this.renderEverything()
			: this.renderError()
	}

	private eChangeMonth(bBackwards: boolean) {
		this.props.changeMonth(bBackwards)
		this.props.getSummary(this.props.initialDate)
	}

	private eChangeScope(sScope: string) {
		this.props.changeScope(sScope)
		this.props.getSummary(this.props.initialDate)
	}

	private eChangeBudget(fBudget: number) {
		this.props.setBudget(fBudget)
		this.props.getSummary(this.props.initialDate)
	}

	private renderSummary() {
		const { nYearlyBudget, oSummary, sScope } = this.props
		// todo: defaults of -1 to shut linter up, later types should be updated to be non nullable, that means changing API elastic.ts file
		const {
			averagePerUnit = -1,
			medianPerUnit = -1,
			modePerUnit = -1,
			numberOfExpenses,
			projectionForScope,
			prospectiveBudgetForForecast,
			totalExpenditure = -1,
		} = oSummary

		const sDisplayPeriod: string = sScope === 'year' ? 'month' : 'day'

		// is the current date within the current month/year. e.g. if current date is may 12th, and it is may 19th. Then it is in the current period (both month and year scope)
		const bInCurrentPeriod: boolean = this.props.initialDate.isSame(
			new Date(),
			// @ts-ignore
			sScope,
		)

		return (
			<div className="ui grid" >
				<div className="five wide column">
					total expenditure:{' '}
					<strong>
						$
						<NumberDisplay
							number={Number(totalExpenditure.toFixed(2))}
						/>
					</strong>
					<br />
					expenses: {numberOfExpenses}
					<br />
					mean average per {sDisplayPeriod}:$
					<NumberDisplay
						number={Number(averagePerUnit.toFixed(2))}
					/>
				</div>
				<div className="five wide column">
					<span title="the most frequently appearing value">
						mode
					</span>{' '}
					per {sDisplayPeriod}: ${modePerUnit.toFixed(2)}
					<br />
					<span title="cumulative total divided by number of items - the classic average">
						mean
					</span>{' '}
					per {sDisplayPeriod}: $
					<NumberDisplay
						number={Number(averagePerUnit.toFixed(2))}
					/>
					<br />
					<span title="the middle value if all values are ordered">
						median
					</span>{' '}
					per {sDisplayPeriod}: ${medianPerUnit.toFixed(2)}
				</div>
				<div className="six wide column">
					{bInCurrentPeriod && (
						<div>
							{/* only show projection data if the current period is incomplete */}
							{projectionForScope && (
								<span>projection for {sScope}:&nbsp;</span>
							)}
							{projectionForScope && (
								<span>
									$
									<NumberDisplay
										number={Number(
											projectionForScope.toFixed(2),
										)}
									/>
								</span>
							)}
							<br />
							{/* only show projection data if the current period is incomplete */}
							<div className="ui input">
								target budget for {sScope}:&nbsp;
								<input
									type="text"
									value={nYearlyBudget || ''}
									onChange={e =>
										this.eChangeBudget(
											Number(e.currentTarget.value),
										)
									}
								/>
							</div>
							{nYearlyBudget && prospectiveBudgetForForecast && (
								<div>
									spend up to $
									<NumberDisplay
										number={Number(
											prospectiveBudgetForForecast.toFixed(
												2,
											),
										)}
									/>
									&nbsp; per {sDisplayPeriod} to come in at $
									{nYearlyBudget} for the {sScope}.
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		)
	}

	private renderSpendingOverTime(timeunits: TimeUnit[]) {
		if (timeunits.length > 0) {
			const chartOptions = {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					yAxes: [
						{
							ticks: {
								beginAtZero: true,
							},
						},
					],
				},
			}

			const afSpendingOverTime: number[] = timeunits.map(oP =>
				Number(oP.total),
			)
			const dataLabels = timeunits.map(oP => {
				// make nice date rendered label
				return this.props.sScope === 'month'
					? moment(this.props.initialDate) // create from currently selected date so that we can correctly render the number of that months days on the x axis
						.date(Number(oP.date))
						.format('Do')
					: moment() // a year only ever has 12 months..
						.month(Number(oP.date) - 1)
						.format('MMM')
			})

			const aDataSets = [
				{
					label: 'Spending over time',
					fillColor: 'rgba(151,187,205,0.2)',
					strokeColor: 'rgba(151,187,205,1)',
					pointColor: 'rgba(151,187,205,1)',
					pointStrokeColor: '#fff',
					pointHighlightFill: '#fff',
					pointHighlightStroke: 'rgba(151,187,205,1)',
					data: afSpendingOverTime,
				},
			]

			if (this.props.oSummary.projectedSpendingOverTime) {
				// render projection data too
				const afSpendingProjection = this.props.oSummary.projectedSpendingOverTime.map(
					oItem => Number(oItem.total.toFixed(2)),
				)

				aDataSets.push({
					label: 'Projected Spending',
					fillColor: 'rgba(220,220,220,0.2)',
					strokeColor: 'rgba(220,220,220,1)',
					pointColor: 'rgba(220,220,220,1)',
					pointStrokeColor: '#fff',
					pointHighlightFill: '#fff',
					pointHighlightStroke: 'rgba(220,220,220,1)',
					data: afSpendingProjection,
				})

				// console.log(afSpendingProjection)
				// and if they have a target adjusted forecast
				if (this.props.oSummary.prospectiveBudgetForForecast) {
					// render projection data too
					// const afAdjustedProjection = this.props.oSummary.projectedSpendingOverTime.map(oItem => this.props.oSummary.prospectiveBudgetForForecast)
					// console.log(afAdjustedProjection)
					// not working :(
					// aDataSets.push(
					// 	{
					// 		label: "Adjusted budget",
					// 		fillColor: "rgba(50,50,50,0.2)",
					// 		strokeColor: "rgba(50,50,50,1)",
					// 		pointColor: "rgba(50,50,50,1)",
					// 		pointStrokeColor: "#fff",
					// 		pointHighlightFill: "#fff",
					// 		pointHighlightStroke: "rgba(50,50,50,1)",
					// 		data: afAdjustedProjection,
					// 	}
					// )
				}
			}

			const chartData = {
				labels: dataLabels,
				datasets: aDataSets,
			}

			return (
				<div>
					<LineChart
						data={chartData}
						options={chartOptions}
						width="100%"
						height="300"
					/>
				</div>
			)
		} else {
			return 'awaiting data'
		}
	}

	private renderExpenses(expenses: Expense[]) {
		return (
			<div>
				<h3>Expenses</h3>
				<ExpenseTable
					eSetFilter={this.eSetFilter}
					expenses={expenses}
				/>
			</div>
		)
	}

	private renderScopeLabel(date: moment.Moment, sScope: string) {
		const sFormat: string = sScope === 'month' ? 'MMMM YYYY' : 'Y'
		return date.format(sFormat)
	}

	private eSetFilter = (term: string, match: string) => {
		this.props.setFilter({ term, match })
		this.props.getSummary(this.props.initialDate)
	}
	private eRemoveFilter = () => {
		this.props.setFilter(null)
		this.props.getSummary(this.props.initialDate)
	}
}

const mapStateToProps = (state: Store.App) => {
	const { initialDate, filter, oSummary, sScope, nYearlyBudget } = state
	return {
		initialDate,
		filter,
		oSummary,
		sScope,
		nYearlyBudget,
	}
}

const mapDispatchToProps = (dispatch: React.Dispatch<Action>) => ({
	changeMonth: (bBackwards: boolean) => dispatch(changeMonth(bBackwards)),
	changeScope: (sScope: string) => dispatch(changeScope(sScope)),
	getSummary: (iDate: moment.Moment) => dispatch(getSummary(iDate)),
	setBudget: (fYearlyBudget: number) => dispatch(setBudget(fYearlyBudget)),
	setFilter: (filter: Filter | null) => dispatch(setFilter(filter)),
})

export default connect(
	mapStateToProps,
	mapDispatchToProps,
)(App)
