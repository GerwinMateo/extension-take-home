#!/usr/bin/env python3

import json
import time
import sys
import os
from typing import Dict, List, Any
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementClickInterceptedException


class ActionReplayer:
    def __init__(self, headless: bool = False):
        self.driver = None
        self.headless = headless
        self.is_replaying = False
        
    def init_driver(self):
        print("🚀 Initializing Google Chrome...")
        
        chrome_options = Options()
        if self.headless:
            chrome_options.add_argument("--headless")
        
        chrome_options.add_argument("--start-maximized")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36")
        chrome_options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        
        self.driver = webdriver.Chrome(options=chrome_options)
        print("✅ Google Chrome initialized")
        
    def replay_trace(self, trace_file_path: str):
        try:
            print(f"📖 Loading trace from: {trace_file_path}")
            
            with open(trace_file_path, 'r', encoding='utf-8') as f:
                trace_data = json.load(f)
            
            if not trace_data.get('actions') or not isinstance(trace_data['actions'], list):
                raise ValueError("Invalid trace format: missing actions array")
            
            recorded_at = trace_data.get('metadata', {}).get('recordedAt', 'unknown time')
            print(f"📊 Trace info: {len(trace_data['actions'])} actions recorded at {recorded_at}")
            
            self.init_driver()
            self.replay_actions(trace_data['actions'])
            
        except Exception as e:
            print(f"❌ Error replaying trace: {str(e)}")
            raise
        finally:
            if self.driver:
                self.driver.quit()
    
    def replay_actions(self, actions: List[Dict[str, Any]]):
        self.is_replaying = True
        
        for i, action in enumerate(actions):
            print(f"\n🔄 Replaying action {i + 1}/{len(actions)}: {action['type']}")
            
            if i > 0:
                time.sleep(0.5)
            
            try:
                self.execute_action(action)
            except Exception as e:
                print(f"❌ Failed to execute action {i + 1}: {str(e)}")
                continue
        
        print("\n✅ Replay completed!")
        self.is_replaying = False
    
    def execute_action(self, action: Dict[str, Any]):
        action_type = action['type']
        
        if action_type == 'click':
            self.handle_click(action)
        elif action_type == 'type':
            self.handle_type(action)
        elif action_type == 'keypress':
            self.handle_keypress(action)
        else:
            print(f"⚠️  Unknown action type: {action_type}")
    
    def handle_click(self, action: Dict[str, Any]):
        selector = action.get('selector')
        if not selector:
            raise ValueError("Click action missing selector")
        
        url = action.get('url')
        if url and self.driver.current_url != url:
            print(f"🌐 Navigating to: {url}")
            self.driver.get(url)
            time.sleep(1)
        
        element = None
        
        # Try multiple selector strategies
        selector_strategies = [
            (By.CSS_SELECTOR, selector),
        ]
        
        # Add XPath strategies if applicable
        if 'data-testid=' in selector:
            try:
                testid = selector.split('=')[1].strip('"')
                selector_strategies.append((By.XPATH, f"//*[@data-testid='{testid}']"))
            except:
                pass
                
        if 'aria-label=' in selector:
            try:
                aria_label = selector.split('=')[1].strip('"')
                selector_strategies.append((By.XPATH, f"//*[@aria-label='{aria_label}']"))
            except:
                pass
                
        if 'title=' in selector:
            try:
                title = selector.split('=')[1].strip('"')
                selector_strategies.append((By.XPATH, f"//*[@title='{title}']"))
            except:
                pass
        
        for strategy in selector_strategies:
            if strategy is None:
                continue
            try:
                element = WebDriverWait(self.driver, 3).until(
                    EC.element_to_be_clickable(strategy)
                )
                print(f"🔄 Found element using: {strategy[0]}")
                break
            except TimeoutException:
                continue
        
        if not element:
            try:
                element = self.driver.find_element(By.CSS_SELECTOR, selector)
            except NoSuchElementException:
                raise ValueError(f"Element not found: {selector}")
        
        try:
            element.click()
            print(f"✅ Clicked: {selector}")
        except ElementClickInterceptedException:
            if 'x' in action and 'y' in action:
                print(f"🔄 Falling back to coordinate click at ({action['x']}, {action['y']})")
                from selenium.webdriver.common.action_chains import ActionChains
                actions = ActionChains(self.driver)
                actions.move_by_offset(action['x'], action['y']).click().perform()
            else:
                self.driver.execute_script("arguments[0].click();", element)
                print(f"✅ Clicked via JavaScript: {selector}")
    
    def handle_type(self, action: Dict[str, Any]):
        selector = action.get('selector')
        if not selector:
            raise ValueError("Type action missing selector")
        
        value = action.get('value')
        if not value:
            print("⚠️  Type action has no value, skipping")
            return
        
        url = action.get('url')
        if url and self.driver.current_url != url:
            print(f"🌐 Navigating to: {url}")
            self.driver.get(url)
            time.sleep(1)
        
        try:
            element = WebDriverWait(self.driver, 3).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
        except TimeoutException:
            raise ValueError(f"Element not found: {selector}")
        
        element.click()
        element.clear()
        element.send_keys(value)
        
        print(f"✅ Typed: \"{value}\" into {selector}")

    def handle_keypress(self, action: Dict[str, Any]):
        selector = action.get('selector')
        key = action.get('key')
        
        if not selector or not key:
            print("⚠️  Keypress action missing selector or key")
            return
        
        url = action.get('url')
        if url and self.driver.current_url != url:
            print(f"🌐 Navigating to: {url}")
            self.driver.get(url)
            time.sleep(1)
        
        try:
            element = WebDriverWait(self.driver, 3).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
        except TimeoutException:
            raise ValueError(f"Element not found: {selector}")
        
        if key == 'Enter':
            element.send_keys(Keys.RETURN)
            print(f"✅ Pressed Enter in {selector}")
        else:
            element.send_keys(key)
            print(f"✅ Pressed {key} in {selector}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python replay.py <trace-file-path> [--headless]")
        print("Example: python replay.py action-trace-2025-08-13T00-39-55-960Z.json")
        sys.exit(1)
    
    trace_file_path = sys.argv[1]
    headless = "--headless" in sys.argv
    
    if not os.path.exists(trace_file_path):
        print(f"❌ Trace file not found: {trace_file_path}")
        sys.exit(1)
    
    replayer = ActionReplayer(headless=headless)
    
    try:
        replayer.replay_trace(trace_file_path)
    except Exception as e:
        print(f"❌ Replay failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
