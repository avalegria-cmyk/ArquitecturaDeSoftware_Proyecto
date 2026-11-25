import { assert } from '@japa/assert'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'

export const plugins: Config['plugins'] = [assert(), pluginAdonisJS(app)]
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = { setup: [], teardown: [] }
export const configureSuite: Config['configureSuite'] = () => {}
