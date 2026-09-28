'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {SearchCheck} from 'lucide-react';

export function AppShell({children}:{children:React.ReactNode}){
 const path=usePathname();
 return <div className="shell">
  <aside className="sidebar">
   <div className="brand"><div className="brandMark">SA</div><div><div className="brandTitle">StartAuto</div><div className="brandSub">RIV catalog reader</div></div></div>
   <nav className="nav"><Link href="/riv-search" className={'navItem '+(path.startsWith('/riv-search')?'active':'')}><SearchCheck size={16}/><span>Поиск RIV</span></Link></nav>
   <div className="sidebarSection"><div className="sectionTitle">Источник</div><div className="statusLine"><i className="statusDot amber"/>RIV.KZ<span className="statusText">основной</span></div></div>
   <div className="userBox"><div className="avatar">R</div><div><div className="userName">StartAuto</div><div className="userRole">RIV режим</div></div></div>
  </aside>
  <main className="main">{children}</main>
 </div>
}