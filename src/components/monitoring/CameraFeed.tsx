import { CameraOff, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Device } from '../../types'
import './camera-optics.css'

export default function CameraFeed({ device, compact = false, overlay }: { device?: Device; compact?: boolean; overlay?: ReactNode }) {
  const state = device ? '未接入视频' : '未分配设备'
  return (
    <figure className={`camera-feed${compact ? ' camera-feed--compact' : ''}${overlay ? ' camera-feed--with-overlay' : ''}`} aria-label={`${device?.id ?? '空闲通道'}，${state}`}>
      <div className="camera-optics" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="camera-top">
        <span className="camera-id"><Video size={15} aria-hidden="true" /><span>{device?.id ?? '空闲通道'}</span></span>
        <span className="camera-status">{device && !compact ? '演示占位' : state}</span>
      </div>
      <div className="camera-center">
        <span className="camera-glyph"><CameraOff size={compact ? 23 : 36} strokeWidth={1.55} aria-hidden="true" /></span>
        {!compact && <strong>{state}</strong>}
        {!compact && device && <span>当前原型不显示真实视频流</span>}
      </div>
      {overlay}
      <figcaption className="camera-bottom"><span>{device ? 'CAMERA 01' : 'AVAILABLE CHANNEL'}</span><span>16:9</span></figcaption>
    </figure>
  )
}
