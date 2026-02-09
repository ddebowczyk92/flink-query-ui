import { v4 as uuidv4 } from 'uuid'
import Tabs from '../controls/tabs/Tabs'
import QueryInfo from './QueryInfo'
import QueryType from './QueryType'

class Queries extends Tabs<QueryInfo> {
    loadTabs(): QueryInfo[] {
        const queryList: QueryInfo[] = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith('query_')) {
                const value = localStorage.getItem(key)
                if (value) {
                    try {
                        const queryInfo = JSON.parse(value)
                        queryList.push(
                            new QueryInfo(
                                queryInfo.title,
                                queryInfo.type,
                                queryInfo.query,
                                queryInfo.id,
                                queryInfo.isPinned,
                                queryInfo.catalog,
                                queryInfo.schema
                            )
                        )
                    } catch (e) {
                        console.error('Error parsing stored query:', e)
                        localStorage.removeItem(key)
                    }
                }
            }
        }
        return queryList
    }

    saveTabs(): void {
        this.tabs.forEach((query) => this.saveTab(query))
    }

    private saveTab(query: QueryInfo): void {
        localStorage.setItem(`query_${query.id}`, JSON.stringify(query))
    }

    deleteTabFromStorage(tabId: string): void {
        localStorage.removeItem(`query_${tabId}`)
    }

    createNewTab(): QueryInfo {
        return new QueryInfo('New Query', QueryType.USER_ADDED, '', uuidv4(), false)
    }

    getCurrentQuery(): QueryInfo {
        return this.getCurrentTab()
    }

    updateQuery(queryId: string, updates: Partial<QueryInfo>, silent = false): void {
        this.updateTab(queryId, updates, silent)
    }

    deleteQuery(queryId: string): void {
        this.deleteTab(queryId)
    }

    setCurrentQuery(queryId: string): void {
        this.setCurrentTab(queryId)
    }
}

export default Queries
