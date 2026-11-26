const { requestAccount } = require('./account')

async function api(action, input = {}) {
  if (!wx.cloud) throw new Error('请在支持云开发的微信版本中打开')
  let result
  try {
    const response = await wx.cloud.callFunction({ name: 'ordering', data: { action, input } })
    result = response.result
  } catch (error) {
    console.warn('CloudBase call failed', action, error)
    const code = Number(error && error.errCode)
    const details = error && (error.errMsg || error.message) || ''
    if ([-501005, -505005].includes(code) || /-505005|FUNCTIONS_NOT_FOUND|function not (?:exists?|found)/i.test(details)) {
      throw new Error('云端服务尚未部署，请联系管理员')
    }
    throw new Error('暂时无法连接云端，请稍后重试')
  }
  if (!result || !result.ok) {
    const error = new Error(result && result.message || '服务暂不可用，请稍后重试')
    if (result && result.code === 'ACCOUNT_REQUIRED') error.redirecting = requestAccount()
    throw error
  }

  return result.data
}

module.exports = { api }
