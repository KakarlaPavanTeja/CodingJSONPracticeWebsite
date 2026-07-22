----------QUESTION_DESCRIPTION_START----------
You are given `numApps` applications and `numAPIs` interchangeable runtime modules, where `runtimes[i]` is the number of minutes module `i` can supply. Each application consumes one runtime minute per minute of operation.


At any moment, one module can power at most one application, but modules may be moved between applications without losing runtime. Determine the maximum number of minutes for which all applications can operate simultaneously.


**Example:**


**Input:**


```
numAPIs = 4
runtimes = [2, 2, 2, 2]
numApps = 2
```


**Output:**


```
4
```


**Explanation:**


- We can assign two APIs to the first application, for a total runtime of `2 + 2 = 4`.


- We can assign the remaining two APIs to the second application, for a total runtime of `2 + 2 = 4`.


- Both applications can run for 4 minutes. The minimum runtime is 4, which is the maximum possible.


**Your Task:**


- Complete the function `findMaxMinRuntime` that takes `numAPIs`, an array `runtimes`, and `numApps` as input and returns the maximum possible minimum runtime across all applications.


**Constraints:**


- `1` <= `numAPIs` <= `10^5`


- `1` <= `runtimes[i]` <= `10^9`


- `1` <= `numApps` <= `numAPIs`


**Input Format**:


- The first line of each test case contains an integer, `numAPIs`.


- The next line contains `numAPIs` integers representing the `runtimes` array.


- The third line contains an integer, `numApps`.


**Output Format:**


- A single integer representing the maximized minimum runtime.


----------QUESTION_DESCRIPTION_END----------


----------SHORT_TEXT_START----------
API Load Balancing
----------SHORT_TEXT_END----------


----------QUESTION_LEVEL_START----------
MEDIUM
----------QUESTION_LEVEL_END----------


----------COMPANIES_START----------
Google
Amazon
Microsoft
D. E. Shaw
----------COMPANIES_END----------


----------DEFAULT_TAGS_START----------
binary_search
greedy
----------DEFAULT_TAGS_END----------


----------BEGINNER_TOPICS_START----------
Arrays
Sorting
----------BEGINNER_TOPICS_END----------


----------INTERMEDIATE_TOPICS_START----------
Binary Search
Greedy
----------INTERMEDIATE_TOPICS_END----------


----------ADVANCED_TOPICS_START----------
Parametric Search
----------ADVANCED_TOPICS_END----------


----------REAL_LIFE_EXAMPLES_START----------
1. A cloud scheduler distributes finite battery-backed API workers across applications so every application remains available for as long as possible.

2. A datacenter balances shared runtime credits among tenants while maximizing the minimum guaranteed service window.

3. A fleet controller allocates interchangeable power modules across devices and searches for the longest duration all devices can operate together.
----------REAL_LIFE_EXAMPLES_END----------


----------FOLLOW_UP_QUESTIONS_START----------


----------FOLLOW_UP_QUESTION_START_1----------


----------QUESTION_START----------
Why is binary search valid for the target runtime?
----------QUESTION_END----------


----------ANSWER_START----------
If all applications can run for a duration `x`, they can also run for every smaller duration. This monotonic feasibility condition allows binary search over the answer.
----------ANSWER_END----------


----------FOLLOW_UP_QUESTION_END_1----------


----------FOLLOW_UP_QUESTION_START_2----------


----------QUESTION_START----------
Why does each API contribute `min(runtime, target)` during the feasibility check?
----------QUESTION_END----------


----------ANSWER_START----------
No API can contribute more than its own runtime, and assigning more than the target duration to one application does not help prove that every application reaches the target.
----------ANSWER_END----------


----------FOLLOW_UP_QUESTION_END_2----------


----------FOLLOW_UP_QUESTIONS_END----------


----------HINTS_START----------


----------HINTS_START_1----------
The answer lies between `0` and the total available runtime divided by the number of applications.
----------HINTS_END_1----------


----------HINTS_START_2----------
For a candidate duration, sum `min(runtime[i], candidate)` across all APIs.
----------HINTS_END_2----------


----------HINTS_START_3----------
The candidate is feasible when the capped runtime sum is at least `candidate * numApps`; use this monotonic check in binary search.
----------HINTS_END_3----------


----------HINTS_END----------


----------CODE_CONTENT_CPP_START----------
#include <bits/stdc++.h>
using namespace std;


class solution {
    public:
    long long findMaxMinRuntime(int numAPIs, vector<int>& runtimes, int numApps) {
        // Write your code here...
        
        
    }
};
----------CODE_CONTENT_CPP_END----------


----------CODE_CONTENT_PYTHON_START----------
class solution:
    def findMaxMinRuntime(self, numAPIs, runtimes, numApps):
        # Write your code here...
        
        pass
----------CODE_CONTENT_PYTHON_END----------


----------CODE_CONTENT_JAVA_START----------
import java.util.*;


public class Solution {
    public static long findMaxMinRuntime(int numAPIs, int[] runtimes, int numApps) {
        //Write your code here...
        
        
    }
}
----------CODE_CONTENT_JAVA_END----------


----------CODE_CONTENT_NODE_JS_START----------
class Solution {
    static findMaxMinRuntime(numAPIs, runtimes, numApps) {
        //Write your code here...
        
        
    }
}
----------CODE_CONTENT_NODE_JS_END----------


----------DEBUG_HELPER_CODE_CPP_START----------


----------PRE_USER_CODE_START----------
#include <bits/stdc++.h>
using namespace std;
----------PRE_USER_CODE_END----------


----------POST_USER_CODE_START----------
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int numAPIs;
    cin >> numAPIs;
    vector<int> runtimes(numAPIs);
    for (int i = 0; i < numAPIs; i++) {
        cin >> runtimes[i];
    }
    int numApps;
    cin >> numApps;
    
    solution sol;
    
    cout << sol.findMaxMinRuntime(numAPIs, runtimes, numApps) << endl;


    return 0;
}
----------POST_USER_CODE_END----------


----------DEBUG_HELPER_CODE_CPP_END----------


----------DEBUG_HELPER_CODE_PYTHON_START----------


----------PRE_USER_CODE_START----------
import sys
----------PRE_USER_CODE_END----------


----------POST_USER_CODE_START----------
numAPIs = int(input())
runtimes = list(map(int, input().split()))
numApps = int(input())
sol = solution()
print(sol.findMaxMinRuntime(numAPIs, runtimes, numApps))
----------POST_USER_CODE_END----------


----------DEBUG_HELPER_CODE_PYTHON_END----------


----------DEBUG_HELPER_CODE_JAVA_START----------


----------PRE_USER_CODE_START----------
import java.util.*;
----------PRE_USER_CODE_END----------


----------POST_USER_CODE_START----------
public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int numAPIs = scanner.nextInt();
        int[] runtimes = new int[numAPIs];
        for (int i = 0; i < numAPIs; i++) {
            runtimes[i] = scanner.nextInt();
        }
        int numApps = scanner.nextInt();
        Solution sol = new Solution();
        System.out.println(sol.findMaxMinRuntime(numAPIs, runtimes, numApps));
        scanner.close();
    }
}
----------POST_USER_CODE_END----------


----------DEBUG_HELPER_CODE_JAVA_END----------


----------CODE_BASE64_CPP_START----------
#include <bits/stdc++.h>
#include <fstream>
#include <cstdlib>
#include <ctime>
#include <chrono>
#include <iomanip>
using namespace std;
using namespace std::chrono;
#include "solution.cpp"
#include <sys/resource.h>


long getPeakRSS() {
    struct rusage rusage;
    getrusage(RUSAGE_SELF, &rusage);
    return rusage.ru_maxrss; // Return peak memory usage in kilobytes
}


int main(int argc, char* argv[]) {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);


    auto total_duration = 0ns;
    int numAPIs;
    cin >> numAPIs;
    vector<int> runtimes(numAPIs);
    for (int i = 0; i < numAPIs; i++) {
        cin >> runtimes[i];
    }
    int numApps;
    cin >> numApps;
    
    solution sol;
    
    auto start = high_resolution_clock::now();
    cout << sol.findMaxMinRuntime(numAPIs, runtimes, numApps) << endl;
    auto stop = high_resolution_clock::now();
    total_duration += duration_cast<nanoseconds>(stop - start);


    


    long memory_used = getPeakRSS();
    float execution_time = total_duration.count()/1e9;
    
    try{
         const char* file_path = argv[2];
         std::ofstream output_file(file_path);
         output_file << std::fixed << std::setprecision(9);
         output_file << "*-SUBMISSION::USER_CODE_FUNCTION_EXECUTION_TIME_KEY-* " << execution_time;
         output_file << "\n";
         output_file << "*-SUBMISSION::USER_CODE_FUNCTION_MEMORY_USAGE_KEY-* " << memory_used;
         output_file.close();
      }
     catch(...){
     }
    return 0;
}
----------CODE_BASE64_CPP_END----------


----------CODE_BASE64_PYTHON_START----------
from solution import solution
import time
import sys
import resource


file_path = sys.argv[2]


total_elapsed_time_ns = 0


numAPIs = int(input())
runtimes = list(map(int, input().split()))
numApps = int(input())


sol = solution()


start_time_ns = time.perf_counter_ns()
print(sol.findMaxMinRuntime(numAPIs, runtimes, numApps))
end_time_ns = time.perf_counter_ns()
total_elapsed_time_ns += end_time_ns - start_time_ns






usage = resource.getrusage(resource.RUSAGE_SELF)
memory_used = usage.ru_maxrss
    
elapsed_time_seconds = total_elapsed_time_ns / 1e9


with open(file_path, 'w') as output_file:
    output_file.write(f"*-SUBMISSION::USER_CODE_FUNCTION_EXECUTION_TIME_KEY-* {elapsed_time_seconds:.9f}")
    output_file.write("\n")
    output_file.write(
        f"*-SUBMISSION::USER_CODE_FUNCTION_MEMORY_USAGE_KEY-* {str(memory_used)}")
----------CODE_BASE64_PYTHON_END----------


----------CODE_BASE64_JAVA_START----------
import java.util.*;
import java.io.FileWriter;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;


public class Main {
    public static long getPeakRSS() {
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        MemoryUsage heapUsage = memoryBean.getHeapMemoryUsage();
        return heapUsage.getUsed() / 1024; // Convert bytes to kilobytes
    }


    public static void main(String[] args) {
        if (args.length < 2) {
            System.out.println("Usage: java Main <file_path>");
            return;
        }
        String file_path = args[1];


        Scanner scanner = new Scanner(System.in);


       long total_elapsed_time_ns = 0; 
       
        int numAPIs = scanner.nextInt();
        int[] runtimes = new int[numAPIs];
        for (int i = 0; i < numAPIs; i++) {
            runtimes[i] = scanner.nextInt();
        }
        int numApps = scanner.nextInt();
        
        Solution sol = new Solution();
        
        long start_time = System.nanoTime();
        System.out.println(sol.findMaxMinRuntime(numAPIs, runtimes, numApps));
        long end_time = System.nanoTime();
        total_elapsed_time_ns += (end_time - start_time);
        scanner.close();


        long memory_used = getPeakRSS();
        double execution_time = total_elapsed_time_ns / 1e9;
        try (FileWriter writer = new FileWriter(file_path)) {
            writer.write("*-SUBMISSION::USER_CODE_FUNCTION_EXECUTION_TIME_KEY-* "+ execution_time);
            writer.write("\n");
            writer.write("*-SUBMISSION::USER_CODE_FUNCTION_MEMORY_USAGE_KEY-* "+ memory_used);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
----------CODE_BASE64_JAVA_END----------


----------CODE_BASE64_NODE_JS_START----------
const fs = require("fs");
const path = require("path");


const solutionPath = path.join(__dirname, "Solution.js");


if (fs.existsSync(solutionPath)) {
    const userCode = fs.readFileSync(solutionPath, "utf8");
    eval(userCode + "\n; global.Solution = Solution;");
} else {
    console.error("Error: Solution.js not found at", solutionPath);
    process.exit(1);
}


async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: node Main.js <output_file_path>');
        process.exit(1);
    }
    const input = fs.readFileSync(0, "utf8").trim().split(/\s+/);
    let idx = 0;


    let total_elapsed_time_ns = 0n;


    const numAPIs = parseInt(input[idx++]);
    const runtimes = [];
    for (let i = 0; i < numAPIs; i++) {
        runtimes.push(parseInt(input[idx++]));
    }
    const numApps = parseInt(input[idx++]);
    
    const startTime = process.hrtime.bigint();
    const result = Solution.findMaxMinRuntime(numAPIs, runtimes, numApps);
    const endTime = process.hrtime.bigint();
    
    console.log(result);
    total_elapsed_time_ns += (endTime - startTime);
    
    const elapsedTimeSeconds = Number(total_elapsed_time_ns) / 1e9;
    const memoryUsedKB = Math.round(process.memoryUsage().rss / 1024);
    const outputContent = 
        `*-SUBMISSION::USER_CODE_FUNCTION_EXECUTION_TIME_KEY-* ${elapsedTimeSeconds.toFixed(9)}\n` +
        `*-SUBMISSION::USER_CODE_FUNCTION_MEMORY_USAGE_KEY-* ${memoryUsedKB}`;


    fs.writeFile(filePath, outputContent, (err) => {
        if (err) {
            console.error('Error writing output file:', err);
            process.exit(1);
        }
    });
}
main();
----------CODE_BASE64_NODE_JS_END----------


----------SOLUTIONS_CPP_START----------
#include <bits/stdc++.h>
using namespace std;


class solution {
public:
    long long findMaxMinRuntime(int numAPIs, vector<int>& runtimes, int numApps) {
        long long low = 0;
        long long high = 0;
        for (int x : runtimes) high += x;
        high /= numApps;
        long long ans = 0;

        auto check = [&](long long mid) {
            long long total_provided = 0;
            for (int r : runtimes) {
                total_provided += min((long long)r, mid);
            }
            return total_provided >= (mid * numApps);
        };


        while (low <= high) {
            long long mid = low + (high - low) / 2;
            if (mid == 0) {
                low = 1;
                continue;
            }
            if (check(mid)) {
                ans = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return ans;
    }
};
----------SOLUTIONS_CPP_END----------


----------SOLUTIONS_PYTHON_START----------
class solution:
    def findMaxMinRuntime(self, numAPIs, runtimes, numApps):
        low = 0
        high = sum(runtimes)
        
        ans = 0
        while low <= high:
            mid = (low + high) // 2
            if mid == 0:
                low = 1
                continue
                
            total_provided = sum(min(r, mid) for r in runtimes)
            
            if total_provided >= mid * numApps:
                ans = mid
                low = mid + 1
            else:
                high = mid - 1
        return ans
----------SOLUTIONS_PYTHON_END----------


----------SOLUTIONS_JAVA_START----------
import java.util.*;


public class Solution {
    public static long findMaxMinRuntime(int numAPIs, int[] runtimes, int numApps) {
        long low = 0;
        long sum = 0;
        for (int r : runtimes) sum += r;
        long high = sum; 


        long ans = 0;
        while (low <= high) {
            long mid = low + (high - low) / 2;
            if (mid == 0) {
                low = 1;
                continue;
            }


            long totalProvided = 0;
            for (int r : runtimes) {
                totalProvided += Math.min((long) r, mid);
            }


            if (totalProvided >= (long) mid * numApps) {
                ans = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return ans;
    }
}


----------SOLUTIONS_JAVA_END----------


----------SOLUTIONS_NODE_JS_START----------
class Solution {
    static findMaxMinRuntime(numAPIs, runtimes, numApps) {
        let low = 0;
        let high = runtimes.reduce((sum, r) => sum + r, 0);
        
        let ans = 0;
        while (low <= high) {
            let mid = Math.floor((low + high) / 2);
            if (mid === 0) {
                low = 1;
                continue;
            }
            
            let totalProvided = runtimes.reduce((sum, r) => sum + Math.min(r, mid), 0);
            
            if (totalProvided >= mid * numApps) {
                ans = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return ans;
    }
}
----------SOLUTIONS_NODE_JS_END----------