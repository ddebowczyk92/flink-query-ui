import TabInfo from './TabInfo'

abstract class Tabs<T extends TabInfo> {
    protected tabs: T[]
    protected currentTabId: string
    protected changeListeners: (() => void)[] = []

    constructor() {
        this.tabs = this.loadTabs()
        if (this.tabs.length === 0) {
            this.tabs.push(this.createNewTab())
        }
        this.currentTabId = this.tabs[0].id
    }

    abstract loadTabs(): T[]
    abstract saveTabs(): void
    abstract deleteTabFromStorage(tabId: string): void
    abstract createNewTab(): T

    getTabs(): T[] {
        return [...this.tabs]
    }

    getCurrentTab(): T {
        if (!this.currentTabId || !this.tabs.some((t) => t.id === this.currentTabId)) {
            if (this.tabs.length === 0) {
                this.tabs.push(this.createNewTab())
            }
            this.currentTabId = this.tabs[0].id
        }
        return this.tabs.find((t) => t.id === this.currentTabId)!
    }

    setCurrentTab(tabId: string): void {
        const tab = this.tabs.find((t) => t.id === tabId)
        if (tab) {
            this.currentTabId = tabId
        } else {
            this.currentTabId = this.tabs[0]?.id || this.createNewTab().id
        }
        this.notifyListeners()
    }

    addTab(): T {
        const newTab = this.createNewTab()
        this.tabs.push(newTab)
        this.currentTabId = newTab.id
        this.saveTabs()
        this.notifyListeners()
        return newTab
    }

    deleteTab(tabId: string): void {
        this.tabs = this.tabs.filter((t) => t.id !== tabId)
        if (this.tabs.length === 0) {
            this.addTab()
        } else if (this.currentTabId === tabId) {
            this.currentTabId = this.tabs[0].id
        }
        this.deleteTabFromStorage(tabId)
        this.notifyListeners()
    }

    updateTab(tabId: string, updates: Partial<T>, silent = false): void {
        const tabIndex = this.tabs.findIndex((t) => t.id === tabId)
        if (tabIndex !== -1) {
            this.tabs[tabIndex] = { ...this.tabs[tabIndex], ...updates }
            this.saveTabs()
            if (!silent) {
                this.notifyListeners()
            }
        }
    }

    addChangeListener(listener: () => void): void {
        this.changeListeners.push(listener)
    }

    removeChangeListener(listener: () => void): void {
        this.changeListeners = this.changeListeners.filter((l) => l !== listener)
    }

    protected notifyListeners(): void {
        this.changeListeners.forEach((listener) => listener())
    }
}

export default Tabs
