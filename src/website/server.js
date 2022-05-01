const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const core = require('@serverless-devs/core');
const request = require('request');
const app = express();


var baseUrl

function getService(service) {
    let serviceTableHeader = '| 服务/业务 | '
    let serviceTableCenter = '| --- | '
    let serviceTableContent = '| 权限/策略 | '
    const serviceKeys = Object.keys(service)
    for (let i = 0; i < serviceKeys.length; i++) {
        serviceTableHeader = serviceTableHeader + serviceKeys[i] + " |  "
        serviceTableCenter = serviceTableCenter + " --- |  "
        serviceTableContent = serviceTableContent + service[serviceKeys[i]].Authorities.join("</br>") + " |  "
    }
    return serviceKeys.length == 0 ? `` : `## 前期准备
使用该项目，推荐您拥有以下的产品权限 / 策略：

${serviceTableHeader}   
${serviceTableCenter} 
${serviceTableContent}   
`
}

function getPublish() {
    const data = yaml.load(fs.readFileSync(path.join(baseUrl, 'publish.yaml'), 'utf8'));
    const packageName = data.Name
    let serviceTable = getService(data.Service)
    const description = `> ***${data.Description}***`
    return {
        'packageName': packageName,
        'serviceTable': serviceTable,
        'description': description
    }
}

function getMarkdown(packageName, description, serviceTable) {
    let baseMarkdown = fs.readFileSync(`${__dirname}/resouce/readme.md`, 'utf8')
    baseMarkdown = baseMarkdown.replace(/\{packageName\}/g, packageName)
    baseMarkdown = baseMarkdown.replace(/\{description\}/g, description)
    baseMarkdown = baseMarkdown.replace(/\{serviceTable\}/g, serviceTable)
    return baseMarkdown
}


app.get('/', (req, res) => {
    baseUrl = req.query.baseuri
    let baseIndexHtml = `Error: Could not found 'baseuri'`
    if (baseUrl) {
        try {
            const publish = getPublish()
            baseIndexHtml = fs.readFileSync(`${__dirname}/resouce/index.html`, 'utf8')
            let baseMarkdown = getMarkdown(publish.packageName, publish.description, publish.serviceTable)
            let tempMarkdown
            let sourceCode
            let previewUrl
            let tempMarkdownSource
            try {
                tempMarkdownSource = fs.readFileSync(path.join(baseUrl, 'readme.md'), 'utf8')
            } catch (e) {
                tempMarkdownSource = ''
            }
            try {
                tempMarkdown = tempMarkdownSource.match(/<appdetail id="flushContent">[^>]+<\/appdetail>/mg)
                tempMarkdown = tempMarkdown[0].replace('<appdetail id="flushContent">\n', '').replace('</appdetail>', '')
            } catch (e) {
                tempMarkdown = '# 应用详情'
            }
            try {
                sourceCode = (tempMarkdownSource.match(/源代码]\([^>]+\)/mg)[0] || '').replace('源代码](', '').replace(')', '')
            } catch (e) {
                sourceCode = ''
            }
            try {
                previewUrl = (tempMarkdownSource.match(/项目预览]\([^>]+\)/mg)[0] || '').replace('项目预览](', '').replace(')', '')
            } catch (e) {
                previewUrl = ''
            }

            baseMarkdown = baseMarkdown.replace('{appdetail}', '')
            baseMarkdown = baseMarkdown.replace('{codepre}', '')
            baseIndexHtml = baseIndexHtml.replace('{baseMarkdown}', baseMarkdown)
            baseIndexHtml = baseIndexHtml.replace('{tempMarkdown}', tempMarkdown)
            baseIndexHtml = baseIndexHtml.replace('{previewUrl}', previewUrl)
            baseIndexHtml = baseIndexHtml.replace('{sourceCode}', sourceCode)
        } catch (e) {
            baseIndexHtml = `Error: ${e.message}`
        }
    }
    res.header('Content-Type', 'text/html;charset=utf-8')
    res.send(baseIndexHtml)
})

app.use(express.text({limit: '10mb'}))


app.post('/image', function (req, res) {
    let tempUrl
    res.header('Content-Type', 'application/json')
    try {
        const token = fs.readFileSync(`${core.getRootHome()}/serverless-devs-platform.dat`, 'utf-8');
        if (token) {
            const getOptions = {
                'method': 'POST',
                'url': 'http://editor.devsapp.cn/images',
                'headers': {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                form: {
                    'safety_code': token
                }
            };
            request(getOptions, function (error, response) {
                if (error) {
                    res.send({
                        "status": "error",
                        "message": error.message
                    })
                } else {
                    tempUrl = JSON.parse(response.body)
                    if (tempUrl.error) {
                        res.send({
                            "status": "error",
                            "message": tempUrl.error
                        })
                    } else if (tempUrl.Response && tempUrl.Response.Error) {
                        res.send({
                            "status": "error",
                            "message": "login failed"
                        })
                    } else {
                        const base64 = req.body.replace(/^data:image\/\w+;base64,/, "")
                        const buffer = new Buffer(base64, 'base64');
                        const uploadOptions = {
                            'method': 'PUT',
                            'url': tempUrl.upload,
                            body: buffer,
                        };
                        request(uploadOptions, function (error, response) {
                            if (error) {
                                res.send({
                                    "status": "error",
                                    "message": error.message
                                })
                            } else {
                                if (response.body.includes("Error")) {
                                    res.send({
                                        "status": "error",
                                        "message": "unknown error, please try again later"
                                    })
                                }
                                res.send(tempUrl.url)
                            }
                        });
                    }
                }
            });
        } else {
            res.send({
                "status": "error",
                "message": "you need to login to registry: s cli registry login"
            })
        }
    } catch (e) {
        res.send({
            "status": "error",
            "message": "you need to login to registry: s cli registry login"
        })
    }
})

app.post('/save', function (req, res) {
    let result
    try {
        const body = req.body.split('----serverless-devs-split-token----')
        const readme = body[1]
        const codepre = body[0] || ""
        const publish = getPublish()
        let baseMarkdown = getMarkdown(publish.packageName, publish.description, publish.serviceTable)
        baseMarkdown = baseMarkdown.replace(/\\`/g, '`')
        baseMarkdown = baseMarkdown.replace('{appdetail}', readme)
        baseMarkdown = baseMarkdown.replace('{codepre}', codepre)
        fs.writeFileSync(path.join(baseUrl, 'readme.md'), baseMarkdown)
        result = {
            "status": "success"
        }
    } catch (e) {
        result = {
            "status": "error",
            "message": e.message
        }
    }
    res.header('Content-Type', 'application/json;charset=utf-8')
    res.send(result)
})

module.exports = app;