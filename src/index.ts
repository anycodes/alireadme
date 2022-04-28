import {InputProps} from './common/entity';
import app from './website/server'
const open = require('open');
const { resolve } = require('path')
export default class ComponentDemo {
    /**
     * demo 实例
     * @param inputs
     * @returns
     */
    public async index(inputs: InputProps) {
        const tempCode = Math.floor(Math.random() * (9000 - 8000 + 1)) + 8000
        app.listen(tempCode, () => {
            open(`http://localhost:${tempCode}/?baseuri=${resolve('./')}`)
        }).on('error', (e) => {
            console.error(e.code, e.message)
        })
    }
}
