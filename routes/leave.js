/**
 * 休假管理模块
 */
const router = require('koa-router')()
const md5 = require('md5')

const Leave = require('../models/leaveSchema')
const Dept = require('../models/deptSchema')

const Counter = require('../models/roleSchema')

const util = require('../utils/util')
const jwt = require('jsonwebtoken')
router.prefix('/leave')

router.get('/list', async (ctx) => {
  let {applyState, type} = ctx.request.query;
  console.log('applyState fuck -->', applyState)
  const {page, skipIndex} = util.pager(ctx.request.query)
  let authorization = ctx.request.headers.authorization
  let {data} = util.decoded(authorization)
  try {
    let params = {};
    if (type === 'approve') {
      if (applyState == 1) {
        console.log('1111fuck')
        // 审核人是当前的登录用户
        params.curAuditUserName = data.userName
        params.applyState = 1
      } else if (applyState > 1) {
        console.log('2222fuck')
        // 这里用到mongodb里面的子文档查询，非常重要
        params = {
          // 子文档里面的userId 等于 当前的登录人
          "auditFlows.userId": data.userId,
          applyState
        }
      } else {
        console.log('3333fuck')
        params = {
          // 子文档里面的userId 等于 当前的登录人
          "auditFlows.userId": data.userId,
        }
      }
    } else {
      console.log('4444fuck')
      params = {
        "applyUser.userId": data.userId
      }
    }
    if (applyState) params.applyState = applyState;
    console.log('fuck params,', params)
    const query = Leave.find(params)
    const list = await query.skip(skipIndex).limit(page.pageSize)
    const total = await Leave.countDocuments(params)
    ctx.body = util.success({
      page: {
        ...page,
        total
      },
      list
    })
  } catch (error) {
    ctx.body = util.fail(`查询失败:${error.stack}`)
  }
})

router.post('/operate', async (ctx) => {
  const {_id, action, ...params} = ctx.request.body;
  let authorization = ctx.request.headers.authorization
  let {data} = util.decoded(authorization)
  if (action === 'create') {
    // XJ202220727, 生成请假单号
    let orderNo = "XJ"
    orderNo += util.formatDate(new Date(), "yyyyMMdd")
    const total = await Leave.countDocuments()
    params.orderNo = orderNo + total
    // 获取用户的上级部门负责人信息
    const id = data.deptId.pop()
    // 查找负责人信息
    let dept = await Dept.findById(id)
    // 获取人事部门和财务部门负责人信息
    let userList = await Dept.find({deptName: {$in: ['人事部门', '财务部门']}})
    let auditUsers = dept.userName;
    // 当前审批人
    let auditFlows = [
      {userId: dept.userId, userName: dept.userName, userEmail: dept.userEmail}
    ]
    userList.map(item => {
      auditFlows.push({userId: item.userId, userName: item.userName, userEmail: item.userEmail})
      auditUsers += ',' + item.userName
    })
    params.auditUsers = auditUsers
    params.curAuditUserName = dept.userName;
    params.auditFlows = auditFlows
    params.applyUser = {
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail
    }
    console.log('fuck params', params)
    let res = await Leave.create(params)
    ctx.body = util.success("", "创建成功")
  } else {
    let res = await Leave.findByIdAndUpdate(_id, {applyState: 5})
    ctx.body = util.success('', '操作成功')
  }
})

module.exports = router
