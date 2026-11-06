import {isValidElement,useState} from 'react';
import {Button} from 'antd';
import type {ButtonProps} from 'antd';
import type {ButtonHTMLAttributes,ReactNode} from 'react';
import './async-button.css';
function labelText(node:ReactNode):string {
 if(typeof node==='string'||typeof node==='number')return String(node);
 if(Array.isArray(node))return node.map(labelText).join('');
 if(isValidElement<{children?:ReactNode}>(node))return labelText(node.props.children);
 return '';
}
function Content({loading,children}:{loading:boolean;children:ReactNode}){
 const [settled,setSettled]=useState(children);
 if(!loading&&settled!==children)setSettled(children);
 return <><span className="async-button-content" style={loading?{visibility:'hidden'}:undefined}>{loading?settled:children}</span>{loading&&<span className="async-button-spinner" aria-hidden="true"/>}</>;
}
export function AsyncButton({loading=false,children,className='',disabled,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{loading?:boolean}){
 return <button {...props} aria-label={props['aria-label']??labelText(children)} className={`async-button ${className}`} disabled={disabled||loading} aria-busy={loading}><Content loading={loading}>{children}</Content></button>;
}
export function AsyncAntButton({loading=false,children,className='',disabled,icon,...props}:ButtonProps){
 const pending=Boolean(loading);
 return <Button {...props} aria-label={props['aria-label']??labelText(children)} autoInsertSpace={false} className={`async-button ${className}`} disabled={disabled||pending} aria-busy={pending}><Content loading={pending}>{icon}{children}</Content></Button>;
}
