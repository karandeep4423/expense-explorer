import { Filter, Summary } from '@shared/declarations'
import moment from 'moment'

export enum ActionType {
	CHANGE_MONTH = 'CHANGE_MONTH',
	CHANGE_SCOPE = 'CHANGE_SCOPE',
	GET_SUMMARY = 'GET_SUMMARY',
	GET_SUMMARY_SUCCEEDED = 'GET_SUMMARY_SUCCEEDED',
	GET_SUMMARY_FAILED = 'GET_SUMMARY_FAILED',
	SET_BUDGET = 'SET_BUDGET',
	SET_DATE = 'SET_DATE',
	SET_FILTER = 'SET_FILTER',
}

export type Action =
	| {
		type: ActionType.SET_DATE
		initialDate: moment.Moment
		endDate: moment.Moment
	}
	| {
		type: ActionType.SET_BUDGET
		nYearlyBudget: number
	}
	| {
		type: ActionType.GET_SUMMARY
		initialDate: moment.Moment
	}
	| {
		type: ActionType.GET_SUMMARY_SUCCEEDED
		oSummary: Summary
	}
	| {
		type: ActionType.GET_SUMMARY_FAILED
	}
	| {
		type: ActionType.CHANGE_MONTH
		bBackwards: boolean
		oSummary: Summary | null
	}
	| {
		type: ActionType.CHANGE_SCOPE
		sScope: string
		oSummary: Summary | null
	}
	| {
		type: ActionType.SET_FILTER
		filter: Filter | null
	}

export const setDates = (initialDate: moment.Moment, endDate: moment.Moment): Action => {
	return {
		type: ActionType.SET_DATE,
		initialDate,
		endDate,
	}
}

export const setBudget = (nYearlyBudget: number): Action => {
	return {
		type: ActionType.SET_BUDGET,
		nYearlyBudget,
	}
}

export const getSummary = (initialDate: moment.Moment): Action => {
	return {
		initialDate,
		type: ActionType.GET_SUMMARY,
	}
}

export const getSummarySucceded = (oSummary: Summary): Action => {
	return {
		type: ActionType.GET_SUMMARY_SUCCEEDED,
		oSummary,
	}
}

export const getSummaryFailed = (): Action => {
	return {
		type: ActionType.GET_SUMMARY_FAILED,
	}
}

export const changeMonth = (bBackwards: boolean): Action => {
	return {
		type: ActionType.CHANGE_MONTH,
		bBackwards,
		oSummary: null,
	}
}

export const changeScope = (sScope: string): Action => {
	return {
		type: ActionType.CHANGE_SCOPE,
		sScope,
		oSummary: null,
	}
}

export const setFilter = (filter: Filter | null): Action => {
	return {
		type: ActionType.SET_FILTER,
		filter,
	}
}
