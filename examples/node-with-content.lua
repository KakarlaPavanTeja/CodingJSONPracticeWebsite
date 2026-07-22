----------QUESTION_DESCRIPTION_START----------
Given two integer arrays, `inorder` and `postorder`, representing the inorder and postorder traversals of a binary tree, respectively, construct and return the corresponding binary tree.


**Example 1:**


Given a tree:
```
      5
     / \
   10   20
       /  \
      25  30
```




**Input:**


``` 
inorder = [10,5,25,20,30], postorder = [10,25,30,20,5]
```


**Output:**


```
5 10 20 null null 25 30
```


**Explanation:**


- The reconstructed binary tree's level-order traversal is `5 10 20 null null 25 30`, matching the given inorder and postorder sequences.


**Example 2:**


**Input:**


```
inorder = [1], postorder = [1]
```


**Output:**


```
1
```


**Explanation:**




- The reconstructed binary tree's level-order traversal is `1`, matching the given inorder and postorder sequences.


**Your Task**


- Complete the provided function `buildBinaryTree` that takes two arguments:
  
  - `inorder`: An array of integers representing the inorder traversal of a binary tree.
  
  - `postorder`: An array of integers representing the postorder traversal of the binary tree.


- The function should return the root node of the constructed binary tree.


**Constraints:**


- `1` <= `inorder.length` <= `2000`


- `inorder.length` == `postorder.length`


- `-2000` <= `inorder[i]`, `postorder[i]` <= `2000`


- `inorder` and `postorder` consist of unique values.


- Each value of `inorder` also appears in `postorder`.


- `inorder` is guaranteed to be the inorder traversal of the tree.


- `postorder` is guaranteed to be the postorder traversal of the tree.




**Input Format:**


- The first line contains an integer `n` representing the number of elements in the inorder and postorder arrays.


- The second line contains `n` space-separated integers representing the elements of the inorder traversal.


- The third line contains `n` space-separated integers representing the elements of the postorder traversal.




**Output Format:**


- The output is a single line containing the level-order traversal of the binary tree.
----------QUESTION_DESCRIPTION_END----------


----------SHORT_TEXT_START----------
Inorder Postorder Tree Build
----------SHORT_TEXT_END----------


----------QUESTION_LEVEL_START----------
MEDIUM
----------QUESTION_LEVEL_END----------


----------COMPANIES_START----------
Google
Microsoft
Amazon
Bloomberg
Adobe
Apple
----------COMPANIES_END----------


----------DEFAULT_TAGS_START----------
binary_tree
tree_construction
----------DEFAULT_TAGS_END----------


----------BEGINNER_TOPICS_START----------
Arrays
Recursion
----------BEGINNER_TOPICS_END----------


----------INTERMEDIATE_TOPICS_START----------
Hash Maps
----------INTERMEDIATE_TOPICS_END----------


----------ADVANCED_TOPICS_START----------
Binary Trees
Tree Reconstruction
----------ADVANCED_TOPICS_END----------


----------REAL_LIFE_EXAMPLES_START----------
1. A serialization service can reconstruct a stored hierarchy when it retains two complementary traversal orders instead of explicit child pointers.

2. Compiler tooling can rebuild an expression-tree structure from ordered traversal data during import or recovery.

3. Visualization software can restore a binary scene hierarchy before rendering or editing it.
----------REAL_LIFE_EXAMPLES_END----------


----------FOLLOW_UP_QUESTIONS_START----------


----------FOLLOW_UP_QUESTION_START_1----------


----------QUESTION_START----------
Why is the last unconsumed postorder value the root of the current subtree?
----------QUESTION_END----------


----------ANSWER_START----------
Postorder visits the left subtree, then the right subtree, and finally the root. Processing postorder from right to left therefore reveals each subtree root first.
----------ANSWER_END----------


----------FOLLOW_UP_QUESTION_END_1----------

----------FOLLOW_UP_QUESTION_START_2----------

----------QUESTION_START----------
Why should the right subtree be constructed before the left subtree?
----------QUESTION_END----------

----------ANSWER_START----------
When postorder is consumed backward, values belonging to the right subtree appear immediately before the root. Building the right side first keeps the shared postorder index aligned.
----------ANSWER_END----------

----------FOLLOW_UP_QUESTION_END_2----------

----------FOLLOW_UP_QUESTIONS_END----------


----------HINTS_START----------


----------HINTS_START_1----------
The last element of the postorder traversal represents the root of the current subtree. Find this root in the inorder traversal to identify its left and right subtrees.
----------HINTS_END_1----------


----------HINTS_START_2----------
Store each inorder value's index in a hash map so subtree boundaries can be found in constant time.
----------HINTS_END_2----------

----------HINTS_START_3----------
Consume postorder from right to left, recursively building the right subtree before the left subtree.
----------HINTS_END_3----------

----------HINTS_END----------


----------CODE_CONTENT_CPP_START----------
#include <bits/stdc++.h>
using namespace std;
/*
class Node {
    int data;
    Node* left;
    Node* right;
    Node(int data) : data(data), left(nullptr), right(nullptr) {}
};
*/


class solution {
public:
    Node* buildBinaryTree(vector<int>& inorder, vector<int>& postorder) {
        //Write your code here...
        
        
    }
};
----------CODE_CONTENT_CPP_END----------


----------CODE_CONTENT_PYTHON_START----------
'''       
 class Node:
    def __init__(self, data):
        self.data = data
        self.left = None
        self.right = None       
 '''
 
class solution:
    def buildBinaryTree(self, inorder, postorder):
        #Write your code here...
        pass
----------CODE_CONTENT_PYTHON_END----------


----------CODE_CONTENT_JAVA_START----------
import java.util.*;
/*
class Node {
    int data;
    Node left, right;


    Node(int data) {
        this.data = data;
        this.left = null;
        this.right = null;
    }
}
*/


public class Solution {
    public static Node buildBinaryTree(List<Integer> inorder, List<Integer> postorder) {
        //Write your code here...
        
        
    }
}
----------CODE_CONTENT_JAVA_END----------


----------CODE_CONTENT_NODE_JS_START----------
/*
class Node {
    constructor(data) {
        this.data = data;
        this.left = null;
        this.right = null;
    }
}
*/


class Solution {
    static buildBinaryTree(inorder, postorder) {
        //Write your code here...
        
        
    }
}
----------CODE_CONTENT_NODE_JS_END----------


----------DEBUG_HELPER_CODE_CPP_START----------


----------PRE_USER_CODE_START----------
#include <bits/stdc++.h>
#include "node.h"
using namespace std;
----------PRE_USER_CODE_END----------


----------POST_USER_CODE_START----------

----------POST_USER_CODE_END----------


----------DEBUG_HELPER_CODE_CPP_END----------


----------DEBUG_HELPER_CODE_PYTHON_START----------


----------PRE_USER_CODE_START----------
class Node:
    def __init__(self, data):
        self.data = data
        self.left = None
        self.right = None
----------PRE_USER_CODE_END----------


----------POST_USER_CODE_START----------

----------POST_USER_CODE_END----------


----------DEBUG_HELPER_CODE_PYTHON_END----------


----------DEBUG_HELPER_CODE_JAVA_START----------


----------PRE_USER_CODE_START----------
import java.util.*;

class Node {
    int data;
    Node left;
    Node right;

    Node(int data) {
        this.data = data;
    }
}
----------PRE_USER_CODE_END----------


----------POST_USER_CODE_START----------

----------POST_USER_CODE_END----------


----------DEBUG_HELPER_CODE_JAVA_END----------


----------CODE_BASE64_CPP_START----------
#include <bits/stdc++.h>
#include <fstream>
#include <cstdlib>
#include <ctime>
#include <chrono>
#include <iomanip>
#include <sys/resource.h>
#include "node.h"
using namespace std;
using namespace std::chrono;
#include "solution.cpp"






long getPeakRSS() {
    struct rusage rusage;
    getrusage(RUSAGE_SELF, &rusage);
    return rusage.ru_maxrss; // Return peak memory usage in kilobytes
}




// Function to print level-order traversal
void printLevelOrder(Node* root) {
    if (!root) return;


    queue<Node*> q;
    q.push(root);


    while (!q.empty()) {
        int levelSize = q.size();
        bool isAnyChildNodePresent = false; // Flag to check if there's at least one real child


        for (int i = 0; i < levelSize; i++) {
            Node* node = q.front();
            q.pop();


            if (node) {
                cout << node->data << " ";
                q.push(node->left);
                q.push(node->right);
                if (node->left || node->right) {
                    isAnyChildNodePresent = true; // If node has children, continue processing next level
                }
            } else {
                cout << "null ";
            }
        }


        // If no children exist in the next level, stop printing additional nulls
        if (!isAnyChildNodePresent) {
            break;
        }
    }
}


int main(int argc, char* argv[]) {
    
    int n;
    cin >> n;


    vector<int> inorder(n), postorder(n);
    for (int i = 0; i < n; i++) cin >> inorder[i];
    for (int i = 0; i < n; i++) cin >> postorder[i];






    solution sol;
    
    auto start = high_resolution_clock::now();
    Node* root = sol.buildBinaryTree(inorder, postorder);
    auto stop = high_resolution_clock::now();
    
    printLevelOrder(root);
    long memory_used = getPeakRSS();
    auto duration = duration_cast<nanoseconds>(stop - start);
    float execution_time = duration.count()/1e9;
    
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


----------NODE_H_CONTENT_START----------
class Node {
public:
    int data;
    Node* left;
    Node* right;
    Node(int data) : data(data), left(nullptr), right(nullptr) {}
};
----------NODE_H_CONTENT_END----------


----------CODE_BASE64_PYTHON_START----------
from solution import solution
import time
import sys
import resource
from collections import deque


class Node:
    def __init__(self, data):
        self.data = data
        self.left = None
        self.right = None




        
        


# Function to print level-order traversal
def printLevelOrder(root):
    if not root:
        return


    queue = deque([root])


    while queue:
        levelSize = len(queue)
        isAnyChildNodePresent = False  # Flag to check if there's at least one real child


        for _ in range(levelSize):
            node = queue.popleft()


            if node:
                print(node.data, end=" ")
                queue.append(node.left)
                queue.append(node.right)
                if node.left or node.right:
                    isAnyChildNodePresent = True  # If node has children, continue processing next level
            else:
                print("null", end=" ")


        if not isAnyChildNodePresent:
            break






if __name__ == "__main__":        
    file_path = sys.argv[2]
    n = int(input())
    inorder = list(map(int, input().split()))
    postorder = list(map(int, input().split()))


    start_time_ns = time.perf_counter_ns()
    sol = solution()
    root = sol.buildBinaryTree(inorder, postorder)
    end_time_ns = time.perf_counter_ns()
    
    printLevelOrder(root)
    usage = resource.getrusage(resource.RUSAGE_SELF)
    memory_used = usage.ru_maxrss  # Maximum resident set size used (in kilobytes)
        
    elapsed_time_ns = end_time_ns - start_time_ns
    elapsed_time_seconds = elapsed_time_ns / 1e9
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


class Node {
    int data;
    Node left, right;


    Node(int data) {
        this.data = data;
        this.left = null;
        this.right = null;
    }
}






public class Main {
    public static long getPeakRSS() {
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        MemoryUsage heapUsage = memoryBean.getHeapMemoryUsage();
        return heapUsage.getUsed() / 1024; // Convert bytes to kilobytes
    }


    // Function to print level-order traversal
    public static void printLevelOrder(Node root) {
        if (root == null) {
            return;
        }
    
        Queue<Node> queue = new LinkedList<>();
        queue.add(root);
    
        while (!queue.isEmpty()) {
            int levelSize = queue.size();
            boolean isAnyChildNodePresent = false;  // Flag to check if there's at least one real child
    
            for (int i = 0; i < levelSize; i++) {
                Node node = queue.poll();
    
                if (node != null) {
                    System.out.print(node.data + " ");
                    queue.add(node.left);
                    queue.add(node.right);
                    if (node.left != null || node.right != null) {
                        isAnyChildNodePresent = true;  // If node has children, continue processing next level
                    }
                } else {
                    System.out.print("null ");
                }
            }
    
            if (!isAnyChildNodePresent) {
                break;
            }
        }
    }


    
    public static void main(String[] args) {
        if (args.length < 2) {
            System.out.println("Usage: java Main <file_path>");
            return;
        }


        String filePath = args[1];
        Scanner scanner = new Scanner(System.in);


        int n = scanner.nextInt();
        List<Integer> inorder = new ArrayList<>();
        List<Integer> postorder = new ArrayList<>();


        for (int i = 0; i < n; i++) {
            inorder.add(scanner.nextInt());
        }
        for (int i = 0; i < n; i++) {
            postorder.add(scanner.nextInt());
        }






        Solution sol = new Solution();
        long startTime = System.nanoTime();
        Node root = sol.buildBinaryTree(inorder, postorder);
        long endTime = System.nanoTime();
        printLevelOrder(root);
        long memory_used = getPeakRSS();
        scanner.close();
        double executionTime = (endTime - startTime) / 1e9;
        
        try (FileWriter writer = new FileWriter(filePath)) {
            writer.write("*-SUBMISSION::USER_CODE_FUNCTION_EXECUTION_TIME_KEY-* " + executionTime);
            writer.write("\n");
            writer.write("*-SUBMISSION::USER_CODE_FUNCTION_MEMORY_USAGE_KEY-* " + memory_used);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
----------CODE_BASE64_JAVA_END----------


----------CODE_BASE64_NODE_JS_START----------
const fs = require("fs");
const path = require("path");


class Node {
    constructor(data) {
        this.data = data;
        this.left = null;
        this.right = null;
    }
}


const solutionPath = path.join(__dirname, "Solution.js");


if (fs.existsSync(solutionPath)) {
    const userCode = fs.readFileSync(solutionPath, "utf8");
    eval(userCode + "\n; global.Solution = Solution;");
} else {
    console.error("Error: Solution.js not found at", solutionPath);
    process.exit(1);
}


// Function to print level-order traversal
function printLevelOrder(root) {
    if (!root) return;


    const queue = [root];


    while (queue.length > 0) {
        const levelSize = queue.length;
        let isAnyChildNodePresent = false;


        for (let i = 0; i < levelSize; i++) {
            const node = queue.shift();


            if (node) {
                process.stdout.write(node.data + " ");
                queue.push(node.left);
                queue.push(node.right);
                if (node.left || node.right) {
                    isAnyChildNodePresent = true;
                }
            } else {
                process.stdout.write("null ");
            }
        }


        if (!isAnyChildNodePresent) {
            break;
        }
    }
}


async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: node Main.js <output_file_path>');
        process.exit(1);
    }


    const input = fs.readFileSync(0, "utf8").trim().split(/\s+/);
    let idx = 0;


    const n = parseInt(input[idx++]);
    const inorder = [];
    const postorder = [];


    for (let i = 0; i < n; i++) {
        inorder.push(parseInt(input[idx++]));
    }
    for (let i = 0; i < n; i++) {
        postorder.push(parseInt(input[idx++]));
    }


    const startTime = process.hrtime.bigint();
    const root = Solution.buildBinaryTree(inorder, postorder);
    const endTime = process.hrtime.bigint();


    printLevelOrder(root);


    const memoryUsedKB = Math.round(process.memoryUsage().rss / 1024);
    const elapsedTimeNs = endTime - startTime;
    const elapsedTimeSeconds = Number(elapsedTimeNs) / 1e9;


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
    unordered_map<int, int> inorderIndex;
    int postorderIndex;

    Node* build(const vector<int>& postorder, int left, int right) {
        if (left > right) return nullptr;
        int value = postorder[postorderIndex--];
        Node* root = new Node(value);
        int middle = inorderIndex[value];
        root->right = build(postorder, middle + 1, right);
        root->left = build(postorder, left, middle - 1);
        return root;
    }

public:
    Node* buildBinaryTree(vector<int>& inorder, vector<int>& postorder) {
        for (int i = 0; i < static_cast<int>(inorder.size()); ++i) {
            inorderIndex[inorder[i]] = i;
        }
        postorderIndex = static_cast<int>(postorder.size()) - 1;
        return build(postorder, 0, static_cast<int>(inorder.size()) - 1);
    }
};
----------SOLUTIONS_CPP_END----------


----------SOLUTIONS_PYTHON_START----------
import sys

class solution:
    def buildBinaryTree(self, inorder, postorder):
        sys.setrecursionlimit(max(1000, len(inorder) * 2 + 10))
        inorder_index = {value: index for index, value in enumerate(inorder)}
        postorder_index = len(postorder) - 1

        def build(left, right):
            nonlocal postorder_index
            if left > right:
                return None
            value = postorder[postorder_index]
            postorder_index -= 1
            root = Node(value)
            middle = inorder_index[value]
            root.right = build(middle + 1, right)
            root.left = build(left, middle - 1)
            return root

        return build(0, len(inorder) - 1)
----------SOLUTIONS_PYTHON_END----------


----------SOLUTIONS_JAVA_START----------
import java.util.*;

public class Solution {
    private static Map<Integer, Integer> inorderIndex;
    private static int postorderIndex;

    private static Node build(List<Integer> postorder, int left, int right) {
        if (left > right) return null;
        int value = postorder.get(postorderIndex--);
        Node root = new Node(value);
        int middle = inorderIndex.get(value);
        root.right = build(postorder, middle + 1, right);
        root.left = build(postorder, left, middle - 1);
        return root;
    }

    public static Node buildBinaryTree(
        List<Integer> inorder,
        List<Integer> postorder
    ) {
        inorderIndex = new HashMap<>();
        for (int i = 0; i < inorder.size(); i++) {
            inorderIndex.put(inorder.get(i), i);
        }
        postorderIndex = postorder.size() - 1;
        return build(postorder, 0, inorder.size() - 1);
    }
}
----------SOLUTIONS_JAVA_END----------


----------SOLUTIONS_NODE_JS_START----------
class Solution {
    static buildBinaryTree(inorder, postorder) {
        const inorderIndex = new Map(
            inorder.map((value, index) => [value, index]),
        );
        let postorderIndex = postorder.length - 1;

        function build(left, right) {
            if (left > right) return null;
            const value = postorder[postorderIndex--];
            const root = new Node(value);
            const middle = inorderIndex.get(value);
            root.right = build(middle + 1, right);
            root.left = build(left, middle - 1);
            return root;
        }

        return build(0, inorder.length - 1);
    }
}
----------SOLUTIONS_NODE_JS_END----------