import React from 'react';
import ReactDOM from 'react-dom';
import { Cascader } from 'antd';

const options = [{
  value: 'zhejiang',
  label: '浙江',
  children: [{
    value: 'hangzhou',
    label: '杭州',
    children: [{
      value: 'xihu',
      label: '西湖',
    }],
  }],
}, {
  value: 'jiangsu',
  label: '江苏',
  children: [{
    value: 'nanjing',
    label: '南京',
    children: [{
      value: 'zhonghuamen',
      label: '中华门',
    }],
  }],
}];

function onChange(value) {
  console.log(value);
}
var mountNode = document.querySelector('app');
ReactDOM.render(
  <Cascader options={options} onChange={onChange} placeholder="请选择地区" />
, mountNode);
