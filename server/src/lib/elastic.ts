import { Summary, Filter, ElasticSummaryResponse, Expense, PossibleTimeUnits } from '@shared/declarations'
import * as ServerTypes from '../declarations'
import { IElasticExpenseDocument } from '../declarations'
import * as moment from 'moment'
import { anMode, nMedian } from './helper'
import { Client } from '@elastic/elasticsearch'
const client = new Client({ node: 'http://elasticsearch:9200' })

export const getDocument = async (
	id: string | number,
): Promise<IElasticExpenseDocument | null> => {
	const result = await client.get(() => ({
		index: process.env.ELASTIC_INDEX,
		type: process.env.ELASTIC_TYPE,
		id,
	}))
	if (result?.body?._source) {
		const oExpense = result.body._source
		return {
			...oExpense,
			vendor: oExpense.Vendor,
			category: oExpense.Category,
			subcategory: oExpense.Subcategory,
			amount: oExpense.Amount,
			date: oExpense.Date,
		}
	} else {
		return null
	}
}

const buildElasticQuery = ({ sLowerDateRange, sUpperDateRange, oFilter, sScope }: ServerTypes.BuildElasticQueryInput) => {

	const nSize = 10000
	const sAggregationScopePeriod = sScope === 'month' ? 'day' : 'month'

	const aMustQueries: unknown[] = []

	aMustQueries.push({
		range: {
			Date: {
				gte: sLowerDateRange,
				lte: sUpperDateRange,
				format: 'dd/MM/yyyy',
			},
		},
	})

	// option free text matching
	if (oFilter) {
		aMustQueries.push({
			match: { [oFilter.term]: oFilter.match },
		})
	}

	const query = {
		index: process.env.ELASTIC_INDEX,
		body: {
			query: {
				bool: {
					must: aMustQueries,
				},
			},
			size: nSize,
			aggs: {
				time_spending_breakdown: {
					date_histogram: {
						field: 'Date',
						interval: sAggregationScopePeriod,
					},
					aggs: {
						unit_total: { sum: { field: 'Amount' } },
					},
				},
				category_spending_breakdown: {
					terms: { field: 'Category', size: nSize },
					aggs: {
						unit_total: { sum: { field: 'Amount' } },
					},
				},
				subcategory_spending_breakdown: {
					terms: { field: 'Fullcategory', size: nSize },
					aggs: {
						unit_total: { sum: { field: 'Amount' } },
					},
				},
			},
			sort: [
				{
					Date: {
						order: 'asc',
					},
				},
			],
		},
	}

	return query
}

export const getExpenseDataFromResults = (queryResult: ElasticSummaryResponse): ServerTypes.ExpenseData => {
	if (!queryResult?.body?.hits?.hits) {
		throw Error
	}
	const { hits } = queryResult.body.hits
	const expensesToReturn: Expense[] = []

	for (let cMatch = 0; cMatch < hits.length; cMatch++) {
		expensesToReturn.push(elasticDocumentToObject(hits[cMatch]._source))
	}

	const totalExpenditure: number = expensesToReturn.reduce(
		(runningTotal: number, { amount }) =>
			runningTotal + amount,
		0,
	)

	return {
		totalExpenditure,
		numberOfExpenses: expensesToReturn.length,
		expenses: expensesToReturn,
	}

}

export const getSummary = async (
	nDate: string,
	sScope: 'month' | 'year',
	oFilter: Filter | undefined,
	nBudget?: number,
): Promise<Summary> => {
	// build date range query
	const oQueriedDate = moment(nDate)
	const sScopePeriod = sScope === 'month' ? 'month' : 'year'

	const sLowerDateRange = oQueriedDate.startOf(sScopePeriod).format('DD/MM/Y')
	const sUpperDateRange = oQueriedDate.endOf(sScopePeriod).format('DD/MM/Y')


	const oQuery = buildElasticQuery({ oFilter, sLowerDateRange, sUpperDateRange, sScope })

	const result: ElasticSummaryResponse = await client.search(oQuery)
		.catch((err: Error) => console.log(JSON.stringify(err, null, 4)))

	let oReturn: Summary = {}

	const expenseData = getExpenseDataFromResults(result)

	oReturn = {
		...expenseData
	}

	if (result?.body?.aggregations) {
		const aggDump = result.body.aggregations

		if (
			aggDump.category_spending_breakdown &&
			aggDump.subcategory_spending_breakdown &&
			aggDump.time_spending_breakdown
		) {
			const fTotalExpenditureForScopedPeriod: number = aggDump.category_spending_breakdown.buckets.reduce(
				(iTotal: number, oBucket) =>
					iTotal + oBucket.unit_total.value,
				0,
			)

			//
			// spending by category
			//

			const aCategorySpending = aggDump.category_spending_breakdown.buckets.map(
				({ key, doc_count, unit_total }) => {
					return {
						category: key,
						expense_count: doc_count,
						total: unit_total.value,
						percent:
							(unit_total.value /
								fTotalExpenditureForScopedPeriod) *
							100,
					}
				},
			)
			oReturn['spending_by_category'] = aCategorySpending

			//
			// spending by subcategory
			//
			const aSubcategorySpending = aggDump.subcategory_spending_breakdown.buckets.map(
				(oSubcategoryBucket) => {
					return {
						category: oSubcategoryBucket.key,
						expense_count: oSubcategoryBucket.doc_count,
						total: oSubcategoryBucket.unit_total.value,
						percent:
							(oSubcategoryBucket.unit_total.value /
								fTotalExpenditureForScopedPeriod) *
							100,
					}
				},
			)
			oReturn['spending_by_subcategory'] = aSubcategorySpending

			//
			// spending over time
			//

			// build up empty state objects
			const oPossibleTimeUnits: PossibleTimeUnits = {}
			// dates of the month
			if (sScope === 'month') {
				// get all dates for the month
				const iNumberOfDays: number = oQueriedDate.daysInMonth() // get number of days in current month
				for (
					let cUnitCreate = 0;
					cUnitCreate < iNumberOfDays;
					cUnitCreate++
				) {
					oPossibleTimeUnits[cUnitCreate + 1] = {}
				}
			}
			// months of the year
			if (sScope === 'year') {
				for (let cUnitCreate = 0; cUnitCreate < 12; cUnitCreate++) {
					oPossibleTimeUnits[cUnitCreate + 1] = {}
				}
			}

			let fNumberOfUnits: number =
				aggDump.time_spending_breakdown.buckets.length

			// current year and year mode
			if (
				sScope === 'year' &&
				moment(oQueriedDate).isSame(new Date(), sScope)
			) {
				// get exact monthly average
				const cDayNumberOfYear: number = moment().dayOfYear()
				const fDecimalMonthsThroughYear: number =
					(cDayNumberOfYear / 365) * 12
				fNumberOfUnits = fDecimalMonthsThroughYear

				if (oReturn['totalExpenditure'] && nBudget) {
					oReturn['prospective_budget_for_forecast'] =
						(nBudget - oReturn['totalExpenditure']) /
						(12 - fDecimalMonthsThroughYear)
				}
			}
			if (
				sScope === 'month' &&
				moment(oQueriedDate).isSame(new Date(), sScope)
			) {
				// get exact monthly average
				const nPresentDateOfCurrentMonth: number = moment().date()
				const nTotalDaysInCurrentMonth: number = moment().daysInMonth()

				const fDecimalDaysThroughMonth: number =
					nPresentDateOfCurrentMonth / nTotalDaysInCurrentMonth

				if (oReturn['totalExpenditure'] && nBudget) {
					oReturn['prospective_budget_for_forecast'] =
						(nBudget - oReturn['totalExpenditure']) /
						(nTotalDaysInCurrentMonth - fDecimalDaysThroughMonth)
				}
			}

			// for each possible time unit, see if we have matching data - or return zeros (missing dates)
			const aTimeUnitSpending = Object.keys(oPossibleTimeUnits).map(
				(sKey: string) => {
					const aoMatchingTimePeriods = aggDump.time_spending_breakdown.buckets.filter(
						(oSpendingSummary) => {
							const oPeriodDate = moment(
								oSpendingSummary.key_as_string,
								'MM/DD/Y',
							)

							if (sScope === 'month') {
								return oPeriodDate.date() === Number(sKey)
							} else {
								return oPeriodDate.month() + 1 === Number(sKey)
							}
						},
					)

					return {
						date: sKey,
						expense_count:
							aoMatchingTimePeriods.length > 0
								? aoMatchingTimePeriods[0].doc_count
								: 0,
						total:
							aoMatchingTimePeriods.length > 0
								? Number(aoMatchingTimePeriods[0].unit_total.value.toFixed(
									0,
								))
								: 0,
					}
				},
			)

			aggDump.time_spending_breakdown.buckets.map((oBucket) => {
				return {
					date: oBucket.key_as_string,
					expense_count: oBucket.doc_count,
					total: oBucket.unit_total.value.toFixed(0),
				}
			})
			oReturn['spending_over_time'] = aTimeUnitSpending

			//
			// summary stats
			//
			const fAverage: number =
				fTotalExpenditureForScopedPeriod / fNumberOfUnits
			oReturn['average_per_unit'] = fAverage

			const itemTotals = aTimeUnitSpending.map(oItem => Number(oItem.total))

			const medianPerUnit = nMedian(itemTotals)
			oReturn['median_per_unit'] = medianPerUnit

			const aMaybeMode = anMode(itemTotals)
			oReturn['mode_per_unit'] =
				aMaybeMode && aMaybeMode.length > 0 ? aMaybeMode[0] : 0

			// projection = average_per_unit * number of units (year scope - 12, month scope - number of days in current month)
			if (moment(oQueriedDate).isSame(new Date(), sScope)) {
				// current scope
				// projected 'scope expenditure'
				const nNumberOfUnits: number =
					sScope === 'year' ? 12 : oQueriedDate.daysInMonth()
				oReturn['projection_for_scope'] = fAverage * nNumberOfUnits

				// projected dated spending
				const aSpendingProjection = aTimeUnitSpending.map(oP => {
					return {
						...oP,
						total: fAverage || 0,
					}
				})

				// projection data is from now until end of period, until now should be real data
				const nCurrentUnitTime =
					sScope === 'year' ? moment().month() + 1 : moment().date()
				// year mode - before current month, so in april, take month jan feb mar
				// april = 3, so we add one
				// month mode - before current date, so on 4th, take 1st 2nd 3rd
				// 18th = 18
				const aMedianData = []
				for (
					let cReplacePeriod = 0;
					cReplacePeriod < nCurrentUnitTime - 1;
					cReplacePeriod++
				) {
					// console.log(aTimeUnitSpending)
					aMedianData.push(aTimeUnitSpending[cReplacePeriod].total)
					aSpendingProjection[cReplacePeriod].total =
						aTimeUnitSpending[cReplacePeriod].total
				}
				// override median data
				oReturn['median_per_unit'] = nMedian(aMedianData) // current period
				const aMaybeMode = anMode(aMedianData)
				oReturn['mode_per_unit'] =
					aMaybeMode && aMaybeMode.length > 0 ? aMaybeMode[0] : 0

				oReturn['projected_spending_over_time'] = aSpendingProjection
			} else {
				oReturn['projection_for_scope'] = null
				oReturn['projected_spending_over_time'] = null
			}
		}
	}

	return oReturn
}

const elasticDocumentToObject = (oDocument: IElasticExpenseDocument): Expense => {
	return {
		...oDocument,
		vendor: oDocument.Vendor,
		category: oDocument.Category,
		subcategory: oDocument.Subcategory,
		amount: oDocument.Amount,
		date: oDocument.Date,
	}
}
